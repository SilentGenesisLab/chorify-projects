-- This is a system-owned seed record whose original label is known.
-- Keep custom service names in the audit report instead of guessing them.
UPDATE "DeployableService"
SET "name" = 'Web 应用'
WHERE "id" = 'svc_cai_web'
  AND POSITION(U&'\FFFD' IN "name") > 0;
