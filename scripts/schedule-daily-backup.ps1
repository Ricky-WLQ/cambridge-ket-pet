# Install the daily ketpet pg_dump → R2 backup as a Windows Scheduled Task.
# Runs every day at 3:00 AM local time (Asia/Shanghai UTC+8).
# Re-running this script is idempotent — Register-ScheduledTask -Force replaces.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/schedule-daily-backup.ps1

$action = New-ScheduledTaskAction `
  -Execute "C:\Program Files\Git\bin\bash.exe" `
  -Argument "-c 'cd /c/Users/wul82/Desktop/cambridge-ket-pet/apps/web && ./node_modules/.bin/tsx scripts/backup-db-to-r2.ts >> /c/Users/wul82/Desktop/cambridge-ket-pet/.backup.log 2>&1'"

$trigger = New-ScheduledTaskTrigger -Daily -At 3am

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -DontStopOnIdleEnd `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 10)

Register-ScheduledTask `
  -TaskName "ketpet-db-backup-daily" `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Daily pg_dump of ketpet -> R2 (7d/4w/12m retention)" `
  -Force | Out-Null

Get-ScheduledTask -TaskName "ketpet-db-backup-daily" |
  Select-Object TaskName, State, @{N='NextRunTime';E={(Get-ScheduledTaskInfo -TaskName $_.TaskName).NextRunTime}}
