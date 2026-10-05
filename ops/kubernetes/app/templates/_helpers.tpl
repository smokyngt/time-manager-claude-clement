{{- define "tm.name" -}}
{{- default "time-manager" .Values.nameOverride | trunc 40 | trimSuffix "-" -}}
{{- end -}}

{{- define "tm.api" -}}{{ include "tm.name" . }}-api{{- end -}}
{{- define "tm.web" -}}{{ include "tm.name" . }}-web{{- end -}}

{{- define "tm.chartLabels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: time-manager
{{- end -}}

{{- define "tm.selector" -}}
app.kubernetes.io/name: {{ include "tm.name" .ctx }}
app.kubernetes.io/instance: {{ .ctx.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "tm.labels" -}}
{{ include "tm.selector" . }}
{{ include "tm.chartLabels" .ctx }}
{{- if .ctx.Chart.AppVersion }}
app.kubernetes.io/version: {{ .ctx.Chart.AppVersion | quote }}
{{- end }}
{{- end -}}

{{- define "tm.image" -}}
{{- if .image.digest -}}
{{ .image.repository }}@{{ .image.digest }}
{{- else -}}
{{ .image.repository }}:{{ .image.tag | default .ctx.Chart.AppVersion }}
{{- end -}}
{{- end -}}

{{- define "tm.pullSecrets" -}}
{{- with .Values.image.pullSecrets }}
imagePullSecrets:
{{- toYaml . | nindent 2 }}
{{- end }}
{{- end -}}

{{- define "tm.scheme" -}}
{{- if .Values.api.tls.enabled -}}https{{- else -}}http{{- end -}}
{{- end -}}

{{- define "tm.dbHost" -}}
{{- default (printf "%s-rw.%s.svc.cluster.local" .Values.postgres.clusterName .Release.Namespace) .Values.postgres.host -}}
{{- end -}}

{{- define "tm.podSecurity" -}}
runAsNonRoot: true
runAsUser: {{ .uid }}
runAsGroup: {{ .uid }}
fsGroup: {{ .uid }}
seccompProfile:
  type: RuntimeDefault
{{- end -}}

{{- define "tm.containerSecurity" -}}
allowPrivilegeEscalation: false
readOnlyRootFilesystem: true
runAsNonRoot: true
capabilities:
  drop:
    - ALL
seccompProfile:
  type: RuntimeDefault
{{- end -}}

{{- define "tm.caVolume" -}}
- name: vault-ca
  secret:
    secretName: {{ .Values.vault.caSecret }}
    defaultMode: 292
{{- end -}}

{{- define "tm.migrationContainer" -}}
image: {{ include "tm.image" (dict "ctx" .ctx "image" .ctx.Values.image.api) | quote }}
imagePullPolicy: {{ .ctx.Values.image.pullPolicy }}
args:
  - {{ .script }}
envFrom:
  - configMapRef:
      name: {{ .ctx.Values.api.envConfigMap }}
env:
  - name: VAULT_PKI_ENABLED
    value: "false"
resources:
  {{- toYaml .ctx.Values.migration.resources | nindent 2 }}
securityContext:
  {{- include "tm.containerSecurity" .ctx | nindent 2 }}
volumeMounts:
  - name: vault-ca
    mountPath: {{ .ctx.Values.vault.caMountPath }}
    readOnly: true
  - name: tmp
    mountPath: /tmp
{{- end -}}
