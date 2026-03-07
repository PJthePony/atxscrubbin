-- SMS & Email opt-in tracking for customers

ALTER TABLE customers ADD COLUMN sms_opt_in BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE customers ADD COLUMN sms_confirmed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE customers ADD COLUMN email_opt_in BOOLEAN NOT NULL DEFAULT false;
