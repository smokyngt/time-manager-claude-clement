locals {
  restore_on           = var.features.restore_jobs
  restore_name         = "${local.pg_name}-restore"
  restore_sa           = "restore"
  restore_vault_sa     = "vault-restore"
  restore_pg_host      = var.restore_logical_target_host == "" ? local.pg_rw_host : var.restore_logical_target_host
  restore_pg_sslmode   = var.restore_logical_target_host == "" ? "verify-full" : "require"
  restore_token_secret = "vault-restore-token"
  restore_age_secret   = "backup-age-identity"
  restore_labels       = merge(local.common_labels, { "app.kubernetes.io/component" = "restore", "timemanager.io/restore" = "true" })

  restore_pg_labels = merge(local.restore_labels, {
    "app.kubernetes.io/name"     = "logical-restore-verify"
    "timemanager.io/restore-job" = "true"
    "timemanager.io/restore-pg"  = "true"
    "timemanager.io/restore-s3"  = "true"
  })

  restore_vault_labels = merge(local.restore_labels, {
    "app.kubernetes.io/name"       = "vault-restore"
    "timemanager.io/restore-job"   = "true"
    "timemanager.io/restore-s3"    = "true"
    "timemanager.io/vault-restore" = "true"
  })

  restore_recovery = merge(
    {
      source   = local.pg_name
      database = var.postgres_database
      owner    = var.postgres_owner
      secret   = { name = local.pg_app_secret }
    },
    var.restore_target_time == "" ? {} : { recoveryTarget = { targetTime = var.restore_target_time } },
  )

  restore_external_clusters = [{
    name = local.pg_name
    barmanObjectStore = {
      destinationPath = local.pg_s3_path
      endpointURL     = var.backup_s3_endpoint
      s3Credentials = {
        accessKeyId     = { name = local.pg_s3_secret, key = "ACCESS_KEY_ID" }
        secretAccessKey = { name = local.pg_s3_secret, key = "ACCESS_SECRET_KEY" }
      }
      wal = { maxParallel = 4 }
    }
  }]

  restore_verify_container = {
    name            = "verify"
    image           = local.backup_image
    imagePullPolicy = "IfNotPresent"
    command         = ["/usr/local/bin/verify.sh", "--remote", "latest"]
    env = concat(
      local.backup_runtime_env,
      local.backup_s3_env,
      [
        { name = "PGHOST", value = local.restore_pg_host },
        { name = "PGPORT", value = tostring(local.pg_port) },
        { name = "PGDATABASE", value = var.postgres_database },
        { name = "PGSSLMODE", value = local.restore_pg_sslmode },
        { name = "PGSSLROOTCERT", value = "${local.backup_ca_mount}/ca.crt" },
        { name = "PGUSER", valueFrom = { secretKeyRef = { name = "restore-postgres", key = "username" } } },
        { name = "PGPASSWORD", valueFrom = { secretKeyRef = { name = "restore-postgres", key = "password" } } },
        { name = "BACKUP_S3_URI", value = local.backup_s3_dump_uri },
        { name = "BACKUP_AGE_IDENTITY_FILE", value = "/run/secrets/age/identity" },
        { name = "VERIFY_STRICT", value = "true" },
      ],
    )
    resources       = var.backup_job_resources
    securityContext = local.backup_container_security
    volumeMounts = concat(local.backup_volume_mounts, [
      { name = "age", mountPath = "/run/secrets/age", readOnly = true },
    ])
  }

  restore_verify_volumes = concat(local.backup_volumes, [
    { name = "age", secret = { secretName = local.restore_age_secret, optional = true, defaultMode = 256 } },
  ])

  restore_vault_container = {
    name            = "vault-restore"
    image           = local.backup_image
    imagePullPolicy = "IfNotPresent"
    command         = ["/usr/bin/env", "bash", "/scripts/vault-restore.sh"]
    env = concat(
      local.backup_runtime_env,
      local.backup_s3_env,
      [
        { name = "VAULT_ADDR", value = local.vault_url },
        { name = "VAULT_CACERT", value = "${local.backup_ca_mount}/ca.crt" },
        { name = "VAULT_TOKEN_FILE", value = "/run/secrets/vault-restore/token" },
        { name = "SNAPSHOT_PASSPHRASE_FILE", value = "/run/secrets/snapshot/passphrase" },
        { name = "BACKUP_S3_URI", value = local.backup_s3_vault_uri },
        { name = "RESTORE_CONFIRM", valueFrom = { secretKeyRef = { name = local.restore_token_secret, key = "confirm", optional = true } } },
        { name = "SNAPSHOT_NAME", valueFrom = { secretKeyRef = { name = local.restore_token_secret, key = "snapshot", optional = true } } },
      ],
    )
    resources       = var.backup_job_resources
    securityContext = local.backup_container_security
    volumeMounts = concat(local.backup_volume_mounts, [
      { name = "scripts", mountPath = "/scripts", readOnly = true },
      { name = "passphrase", mountPath = "/run/secrets/snapshot", readOnly = true },
      { name = "operator-token", mountPath = "/run/secrets/vault-restore", readOnly = true },
    ])
  }

  restore_vault_volumes = concat(local.backup_volumes, [
    { name = "scripts", configMap = { name = local.backup_scripts_cm, defaultMode = 365 } },
    { name = "passphrase", secret = { secretName = local.backup_passphrase_sec, defaultMode = 256 } },
    { name = "operator-token", secret = { secretName = local.restore_token_secret, defaultMode = 256 } },
  ])

  restore_manifests = local.restore_on ? {
    recovery_cluster = <<-YAML
      apiVersion: postgresql.cnpg.io/v1
      kind: Cluster
      metadata:
        name: ${local.restore_name}
        namespace: ${local.ns.databases}
        labels:
          ${indent(4, yamlencode(merge(local.pg_labels, local.restore_labels)))}
      spec:
        description: Recovery drill from the S3 archive of ${local.pg_name}; a separate cluster, never an in-place restore
        instances: ${var.restore_cluster_instances}
        imageName: ${var.postgres_image}
        imagePullPolicy: IfNotPresent
        priorityClassName: default-priority
        enableSuperuserAccess: false
        enablePDB: false
        primaryUpdateStrategy: unsupervised
        logLevel: info
        inheritedMetadata:
          annotations:
            linkerd.io/inject: disabled
        bootstrap:
          recovery:
            ${indent(6, yamlencode(local.restore_recovery))}
        externalClusters:
          ${indent(4, yamlencode(local.restore_external_clusters))}
        postgresql:
          parameters:
            ${indent(6, yamlencode(local.pg_parameters))}
          pg_hba:
            - hostssl all all all scram-sha-256
        managed:
          roles:
            - name: tm_restore
              ensure: present
              login: true
              createdb: true
              passwordSecret:
                name: postgres-restore-credentials
        storage:
          size: ${var.postgres_storage_size}
          storageClass: ${local.pg_storage_class}
          resizeInUseVolumes: true
        walStorage:
          size: ${var.postgres_wal_storage_size}
          storageClass: ${local.pg_storage_class}
          resizeInUseVolumes: true
        resources:
          ${indent(4, yamlencode(var.postgres_resources))}
        affinity:
          enablePodAntiAffinity: true
          topologyKey: kubernetes.io/hostname
          podAntiAffinityType: preferred
          nodeSelector: ${jsonencode(local.data_scheduling.nodeSelector)}
          tolerations: ${jsonencode(local.data_scheduling.tolerations)}
        monitoring:
          enablePodMonitor: false
    YAML

    logical_verify_job = <<-YAML
      apiVersion: batch/v1
      kind: Job
      metadata:
        name: logical-restore-verify-${var.restore_run_id}
        namespace: ${local.ns.backup}
        labels:
          ${indent(4, yamlencode(local.restore_labels))}
      spec:
        backoffLimit: 0
        activeDeadlineSeconds: ${var.backup_job_deadline_seconds}
        ttlSecondsAfterFinished: 604800
        template:
          metadata:
            labels:
              ${indent(8, yamlencode(local.restore_pg_labels))}
            annotations:
              linkerd.io/inject: disabled
          spec:
            serviceAccountName: ${local.restore_sa}
            automountServiceAccountToken: false
            restartPolicy: Never
            priorityClassName: low
            terminationGracePeriodSeconds: 60
            securityContext:
              ${indent(8, yamlencode(local.backup_pod_security))}
            imagePullSecrets:
              - name: ${var.image_pull_secret}
            containers:
              - ${indent(10, yamlencode(local.restore_verify_container))}
            volumes:
              ${indent(8, yamlencode(local.restore_verify_volumes))}
    YAML

    vault_restore_job = <<-YAML
      apiVersion: batch/v1
      kind: Job
      metadata:
        name: vault-restore-${var.restore_run_id}
        namespace: ${local.ns.backup}
        labels:
          ${indent(4, yamlencode(local.restore_labels))}
        annotations:
          timemanager.io/break-glass: "Suspended on purpose. Read the Vault restore runbook, create the Secret ${local.restore_token_secret}, then set spec.suspend=false."
      spec:
        suspend: true
        backoffLimit: 0
        activeDeadlineSeconds: ${var.backup_job_deadline_seconds}
        ttlSecondsAfterFinished: 604800
        template:
          metadata:
            labels:
              ${indent(8, yamlencode(local.restore_vault_labels))}
            annotations:
              linkerd.io/inject: disabled
          spec:
            serviceAccountName: ${local.restore_vault_sa}
            automountServiceAccountToken: false
            restartPolicy: Never
            priorityClassName: low
            terminationGracePeriodSeconds: 60
            securityContext:
              ${indent(8, yamlencode(local.backup_pod_security))}
            imagePullSecrets:
              - name: ${var.image_pull_secret}
            containers:
              - ${indent(10, yamlencode(local.restore_vault_container))}
            volumes:
              ${indent(8, yamlencode(local.restore_vault_volumes))}
    YAML

    "allow-restore-to-postgres" = <<-YAML
      apiVersion: networking.k8s.io/v1
      kind: NetworkPolicy
      metadata:
        name: allow-restore-to-postgres
        namespace: ${local.ns.backup}
        labels:
          ${indent(4, yamlencode(local.restore_labels))}
      spec:
        podSelector:
          matchLabels:
            timemanager.io/restore-pg: "true"
        policyTypes:
          - Egress
        egress:
          - to:
              - namespaceSelector:
                  matchLabels:
                    kubernetes.io/metadata.name: ${local.ns.databases}
                podSelector:
                  matchLabels:
                    ${indent(14, yamlencode(var.postgres_pod_labels))}
            ports:
              - protocol: TCP
                port: ${local.pg_port}
    YAML

    "allow-restore-to-s3" = <<-YAML
      apiVersion: networking.k8s.io/v1
      kind: NetworkPolicy
      metadata:
        name: allow-restore-to-s3
        namespace: ${local.ns.backup}
        labels:
          ${indent(4, yamlencode(local.restore_labels))}
      spec:
        podSelector:
          matchLabels:
            timemanager.io/restore-s3: "true"
        policyTypes:
          - Egress
        egress:
          - to:
              ${indent(8, yamlencode(local.s3_egress_peers))}
            ports:
              - protocol: TCP
                port: ${var.backup_s3_port}
    YAML

    "allow-restore-to-vault" = <<-YAML
      apiVersion: networking.k8s.io/v1
      kind: NetworkPolicy
      metadata:
        name: allow-restore-to-vault
        namespace: ${local.ns.backup}
        labels:
          ${indent(4, yamlencode(local.restore_labels))}
      spec:
        podSelector:
          matchLabels:
            timemanager.io/vault-restore: "true"
        policyTypes:
          - Egress
        egress:
          - to:
              - namespaceSelector:
                  matchLabels:
                    kubernetes.io/metadata.name: ${local.ns.vault}
                podSelector:
                  matchLabels:
                    ${indent(14, yamlencode(local.vault_server_labels))}
            ports:
              - protocol: TCP
                port: 8200
    YAML

    "allow-restore-to-postgres-ingress" = <<-YAML
      apiVersion: networking.k8s.io/v1
      kind: NetworkPolicy
      metadata:
        name: allow-restore-to-postgres
        namespace: ${local.ns.databases}
        labels:
          ${indent(4, yamlencode(local.restore_labels))}
      spec:
        podSelector:
          matchLabels:
            ${indent(6, yamlencode(var.postgres_pod_labels))}
        policyTypes:
          - Ingress
        ingress:
          - from:
              - namespaceSelector:
                  matchLabels:
                    kubernetes.io/metadata.name: ${local.ns.backup}
                podSelector:
                  matchLabels:
                    timemanager.io/restore-pg: "true"
            ports:
              - protocol: TCP
                port: ${local.pg_port}
    YAML
  } : {}
}

resource "kubernetes_service_account_v1" "restore" {
  for_each = local.restore_on ? toset([local.restore_sa, local.restore_vault_sa]) : toset([])

  metadata {
    name      = each.key
    namespace = local.ns.backup
    labels    = local.restore_labels
  }

  automount_service_account_token = false

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_secret_v1" "postgres_restore_backup" {
  for_each = random_password.postgres_restore

  metadata {
    name      = "restore-postgres"
    namespace = local.ns.backup
    labels    = local.restore_labels
  }

  type = "kubernetes.io/basic-auth"

  data = {
    username = "tm_restore"
    password = each.value.result
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubectl_manifest" "restore_network_policy" {
  for_each = { for k, v in local.restore_manifests : k => v if can(regex("^allow-", k)) }

  yaml_body = each.value

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubectl_manifest" "restore_recovery_cluster" {
  for_each = local.restore_on ? toset(["recovery"]) : toset([])

  yaml_body = local.restore_manifests.recovery_cluster

  wait_for_rollout = false

  depends_on = [
    kubectl_manifest.postgres_cluster,
    kubectl_manifest.restore_network_policy,
    kubernetes_secret_v1.postgres_app,
    kubernetes_secret_v1.postgres_restore_databases,
  ]
}

resource "kubectl_manifest" "restore_logical_verify" {
  for_each = local.restore_on ? toset(["verify"]) : toset([])

  yaml_body = local.restore_manifests.logical_verify_job

  wait_for_rollout = false

  depends_on = [
    kubectl_manifest.postgres_cluster,
    kubectl_manifest.restore_network_policy,
    kubectl_manifest.external_secret,
    kubernetes_service_account_v1.restore,
    kubernetes_secret_v1.postgres_restore_backup,
    kubernetes_priority_class_v1.low,
    kubernetes_secret_v1.ca_bundle,
  ]
}

resource "kubectl_manifest" "restore_vault_job" {
  for_each = local.restore_on && local.backup_snapshot_on ? toset(["vault"]) : toset([])

  yaml_body = local.restore_manifests.vault_restore_job

  wait_for_rollout = false

  depends_on = [
    kubectl_manifest.restore_network_policy,
    kubectl_manifest.vault_snapshot_passphrase,
    kubernetes_config_map_v1.backup_scripts,
    kubernetes_service_account_v1.restore,
    kubernetes_priority_class_v1.low,
    kubernetes_secret_v1.ca_bundle,
  ]
}
