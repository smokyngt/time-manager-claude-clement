variable "backup_image_tag" {
  description = "Pinned tag of the backup image (ops/backup: pg_dump 17, aws-cli, age, gpg) used by the logical dump, restore verification and Vault snapshot jobs."
  type        = string
  default     = "0.1.0"

  validation {
    condition     = can(regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$", var.backup_image_tag)) && !contains(["latest", "main", "master"], lower(var.backup_image_tag))
    error_message = "backup_image_tag must be a valid image tag and cannot be a floating tag (latest, main, master)."
  }
}

variable "backup_s3_endpoint" {
  description = "HTTPS endpoint of the S3-compatible object store that holds every backup (CloudNativePG base backups and WAL, Velero, logical dumps, Vault snapshots)."
  type        = string
  default     = "https://s3.fr-par.scw.cloud"

  validation {
    condition     = can(regex("^https://[a-zA-Z0-9.-]+(:[0-9]+)?$", var.backup_s3_endpoint))
    error_message = "backup_s3_endpoint must be an https URL without a path, for example https://s3.fr-par.scw.cloud."
  }
}

variable "backup_s3_region" {
  description = "Region of the backup bucket."
  type        = string
  default     = "fr-par"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.backup_s3_region))
    error_message = "backup_s3_region must be lowercase letters, digits and hyphens."
  }
}

variable "backup_s3_bucket" {
  description = "Bucket that holds every backup. Enable versioning and an object-lock or lifecycle rule on it: the in-tool retention below is not a substitute for bucket-side protection against deletion."
  type        = string
  default     = "time-manager-backups"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", var.backup_s3_bucket))
    error_message = "backup_s3_bucket must be a valid bucket name: 3 to 63 lowercase letters, digits, dots and hyphens."
  }
}

variable "backup_s3_prefix" {
  description = "Key prefix under the bucket; each tool writes to its own sub-prefix (cnpg, velero, logical, vault, longhorn)."
  type        = string
  default     = "time-manager"

  validation {
    condition     = can(regex("^[A-Za-z0-9][A-Za-z0-9._/-]*[A-Za-z0-9]$", var.backup_s3_prefix)) && !strcontains(var.backup_s3_prefix, "//")
    error_message = "backup_s3_prefix must not start or end with a slash and must not contain empty segments."
  }
}

variable "backup_s3_egress_cidrs" {
  description = "Destination networks of the S3 egress NetworkPolicies. Narrow them to the provider ranges where published; 0.0.0.0/0 is cut by backup_s3_egress_except_cidrs."
  type        = list(string)
  default     = ["0.0.0.0/0"]

  validation {
    condition     = length(var.backup_s3_egress_cidrs) > 0 && alltrue([for c in var.backup_s3_egress_cidrs : can(cidrnetmask(c))])
    error_message = "backup_s3_egress_cidrs must hold at least one valid IPv4 CIDR."
  }
}

variable "backup_s3_egress_except_cidrs" {
  description = "Private ranges removed from a 0.0.0.0/0 S3 egress rule so a compromised backup pod cannot reach cluster-internal addresses. Set to [] when the object store is inside the cluster network."
  type        = list(string)
  default     = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16"]
}

variable "backup_s3_port" {
  description = "TCP port of the object store endpoint."
  type        = number
  default     = 443
}

variable "postgres_backup_retention" {
  description = "CloudNativePG retentionPolicy for base backups and WAL (number plus d, w or m)."
  type        = string
  default     = "30d"

  validation {
    condition     = can(regex("^[1-9][0-9]*[dwm]$", var.postgres_backup_retention))
    error_message = "postgres_backup_retention must look like 30d, 8w or 6m."
  }
}

variable "postgres_backup_schedule" {
  description = "Six-field cron (seconds first, UTC) of the CloudNativePG ScheduledBackup; runs one hour before the logical dump."
  type        = string
  default     = "0 30 1 * * *"

  validation {
    condition     = length(split(" ", var.postgres_backup_schedule)) == 6
    error_message = "postgres_backup_schedule must have six fields (seconds minutes hours day month weekday), unlike the five-field CronJob schedules."
  }
}

variable "backup_dump_schedule" {
  description = "Five-field cron (UTC) of the logical pg_dump CronJob."
  type        = string
  default     = "30 2 * * *"

  validation {
    condition     = length(split(" ", var.backup_dump_schedule)) == 5
    error_message = "backup_dump_schedule must be a five-field cron expression."
  }
}

variable "vault_snapshot_schedule" {
  description = "Five-field cron (UTC) of the Vault Raft snapshot CronJob."
  type        = string
  default     = "15 */4 * * *"

  validation {
    condition     = length(split(" ", var.vault_snapshot_schedule)) == 5
    error_message = "vault_snapshot_schedule must be a five-field cron expression."
  }
}

variable "backup_keep" {
  description = "Retention of the logical dumps in S3 (backup.sh prunes after every run): newest per day, per ISO week and per month."
  type = object({
    daily   = optional(number, 7)
    weekly  = optional(number, 4)
    monthly = optional(number, 6)
  })
  default = {}

  validation {
    condition     = var.backup_keep.daily >= 1 && var.backup_keep.weekly >= 0 && var.backup_keep.monthly >= 0
    error_message = "backup_keep.daily must be at least 1 (the newest backup is never pruned); weekly and monthly may be 0."
  }
}

variable "vault_snapshot_keep" {
  description = "Number of encrypted Vault snapshots kept in S3 (42 is one week at the default 4-hour schedule)."
  type        = number
  default     = 42

  validation {
    condition     = var.vault_snapshot_keep >= 6
    error_message = "vault_snapshot_keep must be at least 6 so a corrupted latest snapshot never leaves a single copy."
  }
}

variable "backup_age_recipient" {
  description = "age public key (age1...) that encrypts the logical dumps before upload; empty uploads unencrypted dumps, which hold only ciphertext of personal data but still expose structure. The private identity stays offline and is mounted only for restores."
  type        = string
  default     = ""

  validation {
    condition     = var.backup_age_recipient == "" || can(regex("^age1[a-z0-9]{50,}$", var.backup_age_recipient))
    error_message = "backup_age_recipient must be empty or an age public key starting with age1."
  }
}

variable "vault_backup_passphrase" {
  description = "Passphrase that encrypts the Vault Raft snapshots (gpg symmetric AES256) before upload. Null disables the Vault snapshot CronJob and a check warns, because a Raft snapshot holds every secret and Transit key in clear. Keep a copy offline: without it the snapshots are unreadable."
  type        = string
  default     = null
  sensitive   = true

  validation {
    condition     = try(length(var.vault_backup_passphrase), 24) >= 24
    error_message = "vault_backup_passphrase must be at least 24 characters."
  }
}

variable "backup_scratch_size" {
  description = "sizeLimit of the emptyDir where a dump or snapshot is staged before upload; must exceed the compressed dump size."
  type        = string
  default     = "5Gi"

  validation {
    condition     = can(regex("^[1-9][0-9]*(Mi|Gi)$", var.backup_scratch_size))
    error_message = "backup_scratch_size must look like 5Gi."
  }
}

variable "backup_job_deadline_seconds" {
  description = "activeDeadlineSeconds of the dump, snapshot and verification jobs."
  type        = number
  default     = 3600
}

variable "backup_job_resources" {
  description = "Requests and limits of the backup job containers."
  type = object({
    requests = map(string)
    limits   = map(string)
  })
  default = {
    requests = { cpu = "100m", memory = "256Mi", "ephemeral-storage" = "1Gi" }
    limits   = { memory = "1Gi", "ephemeral-storage" = "8Gi" }
  }
}

variable "velero_aws_plugin_tag" {
  description = "Tag of velero/velero-plugin-for-aws; it must be compatible with the Velero version of the pinned chart."
  type        = string
  default     = "v1.14.4"
}

variable "velero_node_agent" {
  description = "Deploy the Velero node agent (file-system backup and CSI data movement). It mounts /var/lib/kubelet/pods from the host, which needs the privileged namespace the platform grants to velero."
  type        = bool
  default     = false
}

variable "velero_resources" {
  description = "Requests and limits of the Velero server."
  type = object({
    requests = map(string)
    limits   = map(string)
  })
  default = {
    requests = { cpu = "100m", memory = "256Mi" }
    limits   = { memory = "768Mi" }
  }
}

variable "velero_schedules" {
  description = "Velero Schedules, keyed by the namespace they protect (a key of local.ns: app, databases, vault). Velero captures the manifests and CSI volume snapshots; PostgreSQL data is primarily protected by CloudNativePG backups, Vault by Raft snapshots."
  type = map(object({
    schedule         = string
    ttl              = optional(string, "720h0m0s")
    snapshot_volumes = optional(bool, true)
  }))
  default = {
    app       = { schedule = "0 3 * * *" }
    databases = { schedule = "20 3 * * *" }
    vault     = { schedule = "40 3 * * *" }
  }

  validation {
    condition     = alltrue([for k, v in var.velero_schedules : length(split(" ", v.schedule)) == 5])
    error_message = "Every velero_schedules entry needs a five-field cron schedule."
  }
}

variable "longhorn_backup" {
  description = "Longhorn recurring jobs applied to every volume of the default group (used when features.longhorn_backup is true)."
  type = object({
    snapshot_cron   = optional(string, "0 */6 * * *")
    snapshot_retain = optional(number, 8)
    backup_cron     = optional(string, "45 3 * * *")
    backup_retain   = optional(number, 7)
    concurrency     = optional(number, 2)
  })
  default = {}
}

variable "restore_cluster_instances" {
  description = "Instances of the CloudNativePG recovery cluster created when features.restore_jobs is true."
  type        = number
  default     = 1

  validation {
    condition     = var.restore_cluster_instances >= 1 && var.restore_cluster_instances <= 3
    error_message = "restore_cluster_instances must be between 1 and 3."
  }
}

variable "restore_target_time" {
  description = "Point in time (RFC 3339, for example 2026-10-05T09:30:00Z) for the recovery cluster; empty recovers to the end of the archived WAL."
  type        = string
  default     = ""

  validation {
    condition     = var.restore_target_time == "" || can(regex("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(Z|[+-][0-9]{2}:[0-9]{2})$", var.restore_target_time))
    error_message = "restore_target_time must be empty or an RFC 3339 timestamp such as 2026-10-05T09:30:00Z."
  }
}

variable "restore_run_id" {
  description = "Suffix of the restore Job names. Jobs are immutable: change it (drill-2, drill-3) to run another drill."
  type        = string
  default     = "drill-1"

  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$", var.restore_run_id))
    error_message = "restore_run_id must be a DNS label of at most 32 characters."
  }
}

variable "restore_logical_target_host" {
  description = "PostgreSQL host where the logical restore verification creates its scratch database (dropped on exit). Defaults to the production read-write service; point it at the recovery cluster (time-manager-db-restore-rw...) to keep production untouched."
  type        = string
  default     = ""
}
