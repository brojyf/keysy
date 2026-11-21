select cron.alter_job(
  (select jobid from cron.job where jobname = 'delete-idle-sessions'),
  schedule := '0 4 * * *'
);

select cron.alter_job(
  (select jobid from cron.job where jobname = 'delete-old-invitations'),
  schedule := '0 5 * * *'
);
