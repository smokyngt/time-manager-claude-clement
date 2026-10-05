locals {
  backup_image          = "${var.image_registry}/backup:${var.backup_image_tag}"
  backup_s3_dump_uri    = "s3://${var.backup_s3_bucket}/${var.backup_s3_prefix}/logical"
  backup_s3_vault_uri   = "s3://${var.backup_s3_bucket}/${var.backup_s3_prefix}/vault"
  backup_scripts_cm     = "backup-scripts"
  backup_dump_sa        = "pg-dump"
  backup_snapshot_sa    = "vault-snapshot"
  backup_snapshot_role  = "time-manager-vault-snapshot"
  backup_snapshot_on    = nonsensitive(var.vault_backup_passphrase != null)
  backup_passphrase_sec = "vault-snapshot-passphrase"
  backup_uid            = 70
  backup_ca_mount       = "/etc/ssl/internal-ca"

  backup_labels = merge(local.common_labels, { "app.kubernetes.io/component" = "backup" })

  backup_pod_security = {
    runAsNonRoot   = true
    runAsUser      = local.backup_uid
    runAsGroup     = local.backup_uid
    fsGroup        = local.backup_uid
    seccompProfile = { type = "RuntimeDefault" }
  }

  backup_container_security = {
    allowPrivilegeEscalation = false
    readOnlyRootFilesystem   = true
    runAsNonRoot             = true
    runAsUser                = local.backup_uid
    capabilities             = { drop = ["ALL"] }
    seccompProfile           = { type = "RuntimeDefault" }
  }

  backup_s3_env = [
    { name = "BACKUP_S3_CLIENT", value = "aws" },
    { name = "BACKUP_S3_ENDPOINT_URL", value = var.backup_s3_endpoint },
    { name = "AWS_DEFAULT_REGION", value = var.backup_s3_region },
    { name = "AWS_EC2_METADATA_DISABLED", value = "true" },
    { name = "AWS_REQUEST_CHECKSUM_CALCULATION", value = "when_required" },
    { name = "AWS_RESPONSE_CHECKSUM_VALIDATION", value = "when_required" },
    { name = "AWS_ACCESS_KEY_ID", valueFrom = { secretKeyRef = { name = "backup-s3", key = "AWS_ACCESS_KEY_ID" } } },
    { name = "AWS_SECRET_ACCESS_KEY", valueFrom = { secretKeyRef = { name = "backup-s3", key = "AWS_SECRET_ACCESS_KEY" } } },
  ]

  backup_runtime_env = [
    { name = "HOME", value = "/tmp" },
    { name = "TMPDIR", value = "/tmp" },
    { name = "GNUPGHOME", value = "/tmp/gnupg" },
    { name = "BACKUP_DIR", value = "/backups" },
    { name = "TZ", value = "UTC" },
  ]

  backup_volume_mounts = [
    { name = "tmp", mountPath = "/tmp" },
    { name = "work", mountPath = "/backups" },
    { name = "ca", mountPath = local.backup_ca_mount, readOnly = true },
  ]

  backup_volumes = [
    { name = "tmp", emptyDir = { sizeLimit = "64Mi" } },
    { name = "work", emptyDir = { sizeLimit = var.backup_scratch_size } },
    { name = "ca", secret = { secretName = local.ca_bundle_secret, items = [{ key = local.ca_bundle_key, path = "ca.crt" }] } },
  ]

  pg_dump_container = {
    name            = "pg-dump"
    image           = local.backup_image
    imagePullPolicy = "IfNotPresent"
    command         = ["/usr/local/bin/backup.sh"]
    env = concat(
      local.backup_runtime_env,
      local.backup_s3_env,
      [
        { name = "PGHOST", value = local.pg_rw_host },
        { name = "PGPORT", value = tostring(local.pg_port) },
        { name = "PGDATABASE", value = var.postgres_database },
        { name = "PGSSLMODE", value = "verify-full" },
        { name = "PGSSLROOTCERT", value = "${local.backup_ca_mount}/ca.crt" },
        { name = "PGUSER", valueFrom = { secretKeyRef = { name = "postgres-credentials", key = "username" } } },
        { name = "PGPASSWORD", valueFrom = { secretKeyRef = { name = "postgres-credentials", key = "password" } } },
        { name = "BACKUP_S3_URI", value = local.backup_s3_dump_uri },
        { name = "BACKUP_KEEP_DAILY", value = tostring(var.backup_keep.daily) },
        { name = "BACKUP_KEEP_WEEKLY", value = tostring(var.backup_keep.weekly) },
        { name = "BACKUP_KEEP_MONTHLY", value = tostring(var.backup_keep.monthly) },
      ],
      var.backup_age_recipient == "" ? [] : [{ name = "BACKUP_AGE_RECIPIENT", value = var.backup_age_recipient }],
    )
    resources       = var.backup_job_resources
    securityContext = local.backup_container_security
    volumeMounts    = local.backup_volume_mounts
  }

  vault_snapshot_container = {
    name            = "vault-snapshot"
    image           = local.backup_image
    imagePullPolicy = "IfNotPresent"
    command         = ["/usr/bin/env", "bash", "/scripts/vault-snapshot.sh"]
    env = concat(
      local.backup_runtime_env,
      local.backup_s3_env,
      [
        { name = "VAULT_ADDR", value = local.vault_url },
        { name = "VAULT_CACERT", value = "${local.backup_ca_mount}/ca.crt" },
        { name = "VAULT_ROLE", value = local.backup_snapshot_role },
        { name = "VAULT_AUTH_PATH", value = local.vault_auth_path },
        { name = "SNAPSHOT_PASSPHRASE_FILE", value = "/run/secrets/snapshot/passphrase" },
        { name = "BACKUP_S3_URI", value = local.backup_s3_vault_uri },
        { name = "VAULT_SNAPSHOT_KEEP", value = tostring(var.vault_snapshot_keep) },
      ],
    )
    resources       = var.backup_job_resources
    securityContext = local.backup_container_security
    volumeMounts = concat(local.backup_volume_mounts, [
      { name = "scripts", mountPath = "/scripts", readOnly = true },
      { name = "passphrase", mountPath = "/run/secrets/snapshot", readOnly = true },
    ])
  }

  vault_snapshot_volumes = concat(local.backup_volumes, [
    { name = "scripts", configMap = { name = local.backup_scripts_cm, defaultMode = 365 } },
    { name = "passphrase", secret = { secretName = local.backup_passphrase_sec, defaultMode = 256 } },
  ])

  backup_cronjobs = {
    "pg-dump" = <<-YAML
      apiVersion: batch/v1
      kind: CronJob
      metadata:
        name: pg-dump
        namespace: ${local.ns.backup}
        labels:
          ${indent(4, yamlencode(local.backup_labels))}
      spec:
        schedule: "${var.backup_dump_schedule}"
        timeZone: Etc/UTC
        concurrencyPolicy: Forbid
        startingDeadlineSeconds: 3600
        successfulJobsHistoryLimit: 3
        failedJobsHistoryLimit: 3
        jobTemplate:
          metadata:
            labels:
              ${indent(8, yamlencode(local.backup_labels))}
          spec:
            backoffLimit: 2
            activeDeadlineSeconds: ${var.backup_job_deadline_seconds}
            ttlSecondsAfterFinished: 172800
            template:
              metadata:
                labels:
                  ${indent(12, yamlencode(merge(local.backup_labels, { "app.kubernetes.io/name" = "pg-dump", "timemanager.io/postgres-client" = "true", "timemanager.io/s3-client" = "true" })))}
                annotations:
                  linkerd.io/inject: disabled
              spec:
                serviceAccountName: ${local.backup_dump_sa}
                automountServiceAccountToken: false
                restartPolicy: Never
                priorityClassName: low
                terminationGracePeriodSeconds: 60
                securityContext:
                  ${indent(12, yamlencode(local.backup_pod_security))}
                imagePullSecrets:
                  - name: ${var.image_pull_secret}
                containers:
                  - ${indent(14, yamlencode(local.pg_dump_container))}
                volumes:
                  ${indent(12, yamlencode(local.backup_volumes))}
    YAML

    "vault-snapshot" = <<-YAML
      apiVersion: batch/v1
      kind: CronJob
      metadata:
        name: vault-snapshot
        namespace: ${local.ns.backup}
        labels:
          ${indent(4, yamlencode(local.backup_labels))}
      spec:
        schedule: "${var.vault_snapshot_schedule}"
        timeZone: Etc/UTC
        concurrencyPolicy: Forbid
        startingDeadlineSeconds: 1800
        successfulJobsHistoryLimit: 3
        failedJobsHistoryLimit: 3
        jobTemplate:
          metadata:
            labels:
              ${indent(8, yamlencode(local.backup_labels))}
          spec:
            backoffLimit: 1
            activeDeadlineSeconds: ${var.backup_job_deadline_seconds}
            ttlSecondsAfterFinished: 172800
            template:
              metadata:
                labels:
                  ${indent(12, yamlencode(merge(local.backup_labels, { "app.kubernetes.io/name" = "vault-snapshot", "timemanager.io/vault-client" = "true", "timemanager.io/s3-client" = "true" })))}
                annotations:
                  linkerd.io/inject: disabled
              spec:
                serviceAccountName: ${local.backup_snapshot_sa}
                automountServiceAccountToken: true
                restartPolicy: Never
                priorityClassName: low
                terminationGracePeriodSeconds: 60
                securityContext:
                  ${indent(12, yamlencode(local.backup_pod_security))}
                imagePullSecrets:
                  - name: ${var.image_pull_secret}
                containers:
                  - ${indent(14, yamlencode(local.vault_snapshot_container))}
                volumes:
                  ${indent(12, yamlencode(local.vault_snapshot_volumes))}
    YAML
  }

  backup_network_policies = merge(
    {
      "allow-backup-to-postgres" = <<-YAML
        apiVersion: networking.k8s.io/v1
        kind: NetworkPolicy
        metadata:
          name: allow-backup-to-postgres
          namespace: ${local.ns.backup}
          labels:
            ${indent(4, yamlencode(local.backup_labels))}
        spec:
          podSelector:
            matchLabels:
              timemanager.io/postgres-client: "true"
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

      "allow-backup-to-s3" = <<-YAML
        apiVersion: networking.k8s.io/v1
        kind: NetworkPolicy
        metadata:
          name: allow-backup-to-s3
          namespace: ${local.ns.backup}
          labels:
            ${indent(4, yamlencode(local.backup_labels))}
        spec:
          podSelector:
            matchLabels:
              timemanager.io/s3-client: "true"
          policyTypes:
            - Egress
          egress:
            - to:
                ${indent(8, yamlencode(local.s3_egress_peers))}
              ports:
                - protocol: TCP
                  port: ${var.backup_s3_port}
      YAML
    },
    local.backup_snapshot_on ? {
      "allow-backup-to-vault" = <<-YAML
        apiVersion: networking.k8s.io/v1
        kind: NetworkPolicy
        metadata:
          name: allow-backup-to-vault
          namespace: ${local.ns.backup}
          labels:
            ${indent(4, yamlencode(local.backup_labels))}
        spec:
          podSelector:
            matchLabels:
              timemanager.io/vault-client: "true"
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
    } : {},
  )
}

check "vault_snapshot_configured" {
  assert {
    condition     = local.backup_snapshot_on
    error_message = "vault_backup_passphrase is null, so no Vault Raft snapshot CronJob exists. Vault holds every secret and Transit key of the platform, so a lost Raft volume then means total data loss. Set vault_backup_passphrase (24+ characters, also stored offline)."
  }
}

resource "kubernetes_service_account_v1" "backup_pg_dump" {
  metadata {
    name      = local.backup_dump_sa
    namespace = local.ns.backup
    labels    = local.backup_labels
  }

  automount_service_account_token = false

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_service_account_v1" "backup_vault_snapshot" {
  for_each = local.backup_snapshot_on ? toset(["vault-snapshot"]) : toset([])

  metadata {
    name      = local.backup_snapshot_sa
    namespace = local.ns.backup
    labels    = local.backup_labels
  }

  automount_service_account_token = true

  depends_on = [kubernetes_namespace_v1.this]
}

resource "vault_policy" "vault_snapshot" {
  for_each = local.backup_snapshot_on ? toset(["vault-snapshot"]) : toset([])

  name   = local.backup_snapshot_role
  policy = <<-EOT
    path "sys/storage/raft/snapshot" {
      capabilities = ["read"]
    }
  EOT

  depends_on = [helm_release.vault]
}

resource "vault_kubernetes_auth_backend_role" "vault_snapshot" {
  for_each = local.backup_snapshot_on ? toset(["vault-snapshot"]) : toset([])

  backend                          = vault_auth_backend.kubernetes.path
  role_name                        = local.backup_snapshot_role
  bound_service_account_names      = [local.backup_snapshot_sa]
  bound_service_account_namespaces = [local.ns.backup]
  token_policies                   = [vault_policy.vault_snapshot[each.key].name]
  token_ttl                        = 900
  token_max_ttl                    = 1800
  token_num_uses                   = 0

  depends_on = [vault_kubernetes_auth_backend_config.this]
}

resource "vault_kv_secret_v2" "vault_snapshot_passphrase" {
  for_each = local.backup_snapshot_on ? toset(["vault-snapshot"]) : toset([])

  mount     = vault_mount.kv.path
  name      = "backup/vault-snapshot"
  data_json = jsonencode({ passphrase = var.vault_backup_passphrase })

  depends_on = [vault_kv_secret_backend_v2.kv]
}

resource "kubectl_manifest" "vault_snapshot_passphrase" {
  for_each = local.backup_snapshot_on ? toset(["vault-snapshot"]) : toset([])

  yaml_body = <<-YAML
    apiVersion: external-secrets.io/v1
    kind: ExternalSecret
    metadata:
      name: ${local.backup_passphrase_sec}
      namespace: ${local.ns.backup}
      labels:
        ${indent(4, yamlencode(local.backup_labels))}
    spec:
      refreshInterval: 1h
      secretStoreRef:
        name: ${var.eso_cluster_secret_store}
        kind: ClusterSecretStore
      target:
        name: ${local.backup_passphrase_sec}
        creationPolicy: Owner
      data:
        - secretKey: passphrase
          remoteRef:
            key: backup/vault-snapshot
            property: passphrase
  YAML

  depends_on = [
    kubectl_manifest.cluster_secret_store,
    vault_kv_secret_v2.vault_snapshot_passphrase,
  ]
}

resource "kubernetes_config_map_v1" "backup_scripts" {
  metadata {
    name      = local.backup_scripts_cm
    namespace = local.ns.backup
    labels    = local.backup_labels
  }

  data = {
    "vault-snapshot.sh" = file("${path.module}/files/backup/vault-snapshot.sh")
    "vault-restore.sh"  = file("${path.module}/files/backup/vault-restore.sh")
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubectl_manifest" "backup_network_policy" {
  for_each = local.backup_network_policies

  yaml_body = each.value

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubectl_manifest" "backup_cronjob" {
  for_each = { for k, v in local.backup_cronjobs : k => v if k != "vault-snapshot" || local.backup_snapshot_on }

  yaml_body = each.value

  depends_on = [
    kubectl_manifest.backup_network_policy,
    kubectl_manifest.postgres_cluster,
    kubectl_manifest.external_secret,
    kubectl_manifest.vault_snapshot_passphrase,
    kubernetes_service_account_v1.backup_pg_dump,
    kubernetes_service_account_v1.backup_vault_snapshot,
    vault_kubernetes_auth_backend_role.vault_snapshot,
    kubernetes_config_map_v1.backup_scripts,
    kubernetes_priority_class_v1.low,
    kubernetes_secret_v1.ca_bundle,
  ]
}

locals {
  velero_name        = "velero"
  velero_s3_prefix   = "${var.backup_s3_prefix}/velero"
  velero_credentials = "velero-credentials"

  velero_labels = merge(local.common_labels, { "app.kubernetes.io/component" = "backup" })

  velero_container_security = {
    allowPrivilegeEscalation = false
    readOnlyRootFilesystem   = true
    runAsNonRoot             = true
    capabilities             = { drop = ["ALL"] }
    seccompProfile           = { type = "RuntimeDefault" }
  }

  velero_values = {
    fullnameOverride  = local.velero_name
    priorityClassName = "default-priority"
    resources         = var.velero_resources
    upgradeJobResources = {
      requests = { cpu = "50m", memory = "128Mi" }
      limits   = { memory = "256Mi" }
    }
    podLabels = { "app.kubernetes.io/part-of" = "time-manager", "app.kubernetes.io/component" = "backup" }

    initContainers = [{
      name            = "velero-plugin-for-aws"
      image           = "velero/velero-plugin-for-aws:${var.velero_aws_plugin_tag}"
      imagePullPolicy = "IfNotPresent"
      securityContext = local.velero_container_security
      volumeMounts    = [{ mountPath = "/target", name = "plugins" }]
    }]

    podSecurityContext = {
      runAsNonRoot   = true
      runAsUser      = 65532
      runAsGroup     = 65532
      fsGroup        = 65532
      seccompProfile = { type = "RuntimeDefault" }
    }
    containerSecurityContext = local.velero_container_security

    configuration = {
      features                 = "EnableCSI"
      defaultVolumesToFsBackup = false
      logFormat                = "json"
      backupStorageLocation = [{
        name       = "default"
        provider   = "aws"
        bucket     = var.backup_s3_bucket
        prefix     = local.velero_s3_prefix
        default    = true
        accessMode = "ReadWrite"
        credential = { name = local.velero_credentials, key = "cloud" }
        config = {
          region           = var.backup_s3_region
          s3Url            = var.backup_s3_endpoint
          s3ForcePathStyle = "true"
        }
      }]
      volumeSnapshotLocation = []
    }

    credentials      = { useSecret = true, existingSecret = local.velero_credentials }
    backupsEnabled   = true
    snapshotsEnabled = false
    deployNodeAgent  = var.velero_node_agent
    upgradeCRDs      = true
    cleanUpCRDs      = false

    podDisruptionBudget = {
      enabled        = true
      maxUnavailable = 1
      minAvailable   = ""
    }

    metrics = {
      enabled        = true
      serviceMonitor = { enabled = false }
    }
  }

  velero_manifests = {
    for k, v in var.velero_schedules : k => <<-YAML
      apiVersion: velero.io/v1
      kind: Schedule
      metadata:
        name: ${k}-daily
        namespace: ${local.ns.velero}
        labels:
          ${indent(4, yamlencode(local.velero_labels))}
      spec:
        schedule: "${v.schedule}"
        useOwnerReferencesInBackup: false
        template:
          ttl: ${v.ttl}
          storageLocation: default
          includedNamespaces:
            - ${lookup(local.ns, k, k)}
          includeClusterResources: false
          snapshotVolumes: ${v.snapshot_volumes}
          defaultVolumesToFsBackup: false
    YAML
  }

  velero_egress_policies = {
    "allow-velero-to-s3" = <<-YAML
      apiVersion: networking.k8s.io/v1
      kind: NetworkPolicy
      metadata:
        name: allow-velero-to-s3
        namespace: ${local.ns.velero}
        labels:
          ${indent(4, yamlencode(local.velero_labels))}
      spec:
        podSelector: {}
        policyTypes:
          - Egress
        egress:
          - to:
              ${indent(8, yamlencode(local.s3_egress_peers))}
            ports:
              - protocol: TCP
                port: ${var.backup_s3_port}
    YAML

    "allow-velero-to-kube-api" = <<-YAML
      apiVersion: networking.k8s.io/v1
      kind: NetworkPolicy
      metadata:
        name: allow-velero-to-kube-api
        namespace: ${local.ns.velero}
        labels:
          ${indent(4, yamlencode(local.velero_labels))}
      spec:
        podSelector: {}
        policyTypes:
          - Egress
        egress:
          - to:
              ${indent(8, yamlencode(local.kube_api_egress_peers))}
            ports:
              ${indent(8, yamlencode(local.kube_api_egress_ports))}
    YAML
  }
}

resource "kubernetes_resource_quota_v1" "velero" {
  metadata {
    name      = "velero"
    namespace = local.ns.velero
    labels    = local.velero_labels
  }

  spec {
    hard = {
      "pods"            = "20"
      "requests.cpu"    = "2"
      "requests.memory" = "4Gi"
      "limits.memory"   = "8Gi"
      "secrets"         = "50"
      "configmaps"      = "30"
    }
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubernetes_limit_range_v1" "velero" {
  metadata {
    name      = "velero-defaults"
    namespace = local.ns.velero
    labels    = local.velero_labels
  }

  spec {
    limit {
      type = "Container"

      default_request = {
        cpu    = "50m"
        memory = "128Mi"
      }

      default = {
        memory = "512Mi"
      }
    }
  }

  depends_on = [kubernetes_namespace_v1.this]
}

resource "kubectl_manifest" "velero_egress_policy" {
  for_each = local.velero_egress_policies

  yaml_body = each.value

  depends_on = [kubernetes_namespace_v1.this]
}

resource "helm_release" "velero" {
  name       = "velero"
  repository = "https://vmware-tanzu.github.io/helm-charts"
  chart      = "velero"
  version    = local.chart_versions["velero"]
  namespace  = local.ns.velero

  wait            = true
  timeout         = 900
  atomic          = true
  cleanup_on_fail = true

  values = [yamlencode(local.velero_values)]

  depends_on = [
    kubernetes_namespace_v1.this,
    kubernetes_resource_quota_v1.velero,
    kubernetes_limit_range_v1.velero,
    kubectl_manifest.velero_egress_policy,
    kubectl_manifest.external_secret,
    kubernetes_priority_class_v1.default_priority,
    helm_release.kube_prometheus_stack,
  ]
}

resource "kubectl_manifest" "velero_schedule" {
  for_each = local.velero_manifests

  yaml_body = each.value

  depends_on = [helm_release.velero]
}

locals {
  longhorn_jobs = var.features.longhorn_backup ? {
    snapshot = { task = "snapshot", cron = var.longhorn_backup.snapshot_cron, retain = var.longhorn_backup.snapshot_retain }
    backup   = { task = "backup", cron = var.longhorn_backup.backup_cron, retain = var.longhorn_backup.backup_retain }
  } : {}

  longhorn_manifests = merge(
    {
      for k, v in local.longhorn_jobs : "recurring-job-${k}" => <<-YAML
        apiVersion: longhorn.io/v1beta2
        kind: RecurringJob
        metadata:
          name: time-manager-${k}
          namespace: ${local.ns.longhorn}
          labels:
            ${indent(4, yamlencode(local.velero_labels))}
        spec:
          name: time-manager-${k}
          task: ${v.task}
          cron: "${v.cron}"
          retain: ${v.retain}
          concurrency: ${var.longhorn_backup.concurrency}
          groups:
            - default
      YAML
    },
    {
      for k, v in local.longhorn_jobs : "backup-target" => <<-YAML
        apiVersion: longhorn.io/v1beta2
        kind: BackupTarget
        metadata:
          name: default
          namespace: ${local.ns.longhorn}
          labels:
            ${indent(4, yamlencode(local.velero_labels))}
        spec:
          backupTargetURL: s3://${var.backup_s3_bucket}@${var.backup_s3_region}/${var.backup_s3_prefix}/longhorn
          credentialSecret: longhorn-s3
          pollInterval: 5m0s
      YAML
      if k == "backup"
    },
    {
      for k, v in local.longhorn_jobs : "external-secret" => <<-YAML
        apiVersion: external-secrets.io/v1
        kind: ExternalSecret
        metadata:
          name: longhorn-s3
          namespace: ${local.ns.longhorn}
          labels:
            ${indent(4, yamlencode(local.velero_labels))}
        spec:
          refreshInterval: 1h
          secretStoreRef:
            name: ${var.eso_cluster_secret_store}
            kind: ClusterSecretStore
          target:
            name: longhorn-s3
            creationPolicy: Owner
            template:
              engineVersion: v2
              data:
                AWS_ACCESS_KEY_ID: "{{ .access_key_id }}"
                AWS_SECRET_ACCESS_KEY: "{{ .secret_access_key }}"
                AWS_ENDPOINTS: ${var.backup_s3_endpoint}
          data:
            - secretKey: access_key_id
              remoteRef:
                key: backup/s3
                property: access_key_id
            - secretKey: secret_access_key
              remoteRef:
                key: backup/s3
                property: secret_access_key
      YAML
      if k == "backup"
    },
  )
}

resource "kubectl_manifest" "longhorn" {
  for_each = local.longhorn_manifests

  yaml_body = each.value

  depends_on = [
    kubernetes_namespace_v1.this,
    kubectl_manifest.cluster_secret_store,
  ]
}

locals {
  backup_alert_manifest = <<-YAML
    apiVersion: monitoring.coreos.com/v1
    kind: PrometheusRule
    metadata:
      name: backup-cronjobs
      namespace: ${local.ns.backup}
      labels:
        ${indent(4, yamlencode(merge(local.backup_labels, { release = var.prometheus_release_label })))}
    spec:
      groups:
        - name: time-manager-backup-cronjobs
          rules:
            - alert: LogicalBackupStale
              expr: |
                (time() - kube_cronjob_status_last_successful_time{namespace="${local.ns.backup}",cronjob="pg-dump"} > 93600)
                or
                ((time() - kube_cronjob_created{namespace="${local.ns.backup}",cronjob="pg-dump"} > 93600)
                  unless on (namespace, cronjob) kube_cronjob_status_last_successful_time)
              for: 10m
              labels:
                severity: critical
                workload: backup
              annotations:
                summary: No successful logical PostgreSQL dump for over 26 hours
                description: The pg-dump CronJob last succeeded more than 26 hours ago or never. Check the Job logs and the S3 credentials; RPO is now above one day.
            - alert: VaultSnapshotStale
              expr: |
                (time() - kube_cronjob_status_last_successful_time{namespace="${local.ns.backup}",cronjob="vault-snapshot"} > 18000)
                or
                ((time() - kube_cronjob_created{namespace="${local.ns.backup}",cronjob="vault-snapshot"} > 18000)
                  unless on (namespace, cronjob) kube_cronjob_status_last_successful_time)
              for: 10m
              labels:
                severity: critical
                workload: backup
              annotations:
                summary: No successful Vault Raft snapshot for over 5 hours
                description: The vault-snapshot CronJob runs every 4 hours. Check that Vault is unsealed, the Kubernetes auth role exists and S3 is reachable.
            - alert: BackupJobFailed
              expr: kube_job_status_failed{namespace="${local.ns.backup}"} > 0
              for: 5m
              labels:
                severity: warning
                workload: backup
              annotations:
                summary: A backup Job failed
                description: Job {{ $labels.job_name }} failed. Read its logs before the next schedule.
  YAML
}

resource "kubectl_manifest" "backup_alerts" {
  yaml_body = local.backup_alert_manifest

  depends_on = [
    kubernetes_namespace_v1.this,
    helm_release.kube_prometheus_stack,
  ]
}
