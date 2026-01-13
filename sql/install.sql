CREATE TABLE IF NOT EXISTS mdt_tax_settings (
  id INT NOT NULL AUTO_INCREMENT,
  default_rate FLOAT NOT NULL DEFAULT 0.15,
  allow_tax_free TINYINT(1) NOT NULL DEFAULT 1,
  allow_doj_tax_free TINYINT(1) NOT NULL DEFAULT 1,
  max_tax_free_invoice INT NOT NULL DEFAULT 10000,
  alert_threshold_tax_free INT NOT NULL DEFAULT 5,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS mdt_tax_rules (
  id INT NOT NULL AUTO_INCREMENT,
  job_name VARCHAR(60) NOT NULL,
  rate FLOAT NOT NULL DEFAULT 0.15,
  allow_tax_free TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_mdt_tax_rules_job (job_name)
);

CREATE TABLE IF NOT EXISTS mdt_products (
  id INT NOT NULL AUTO_INCREMENT,
  job_name VARCHAR(60) NOT NULL,
  label VARCHAR(120) NOT NULL,
  price INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mdt_products_job (job_name)
);

CREATE TABLE IF NOT EXISTS mdt_invoices (
  id INT NOT NULL AUTO_INCREMENT,
  invoice_id VARCHAR(64) NOT NULL,
  job_name VARCHAR(60) NOT NULL,
  issuer_identifier VARCHAR(60) NOT NULL,
  issuer_name VARCHAR(120) NOT NULL,
  target_identifier VARCHAR(60) DEFAULT NULL,
  target_name VARCHAR(120) DEFAULT NULL,
  mode VARCHAR(40) NOT NULL DEFAULT 'citoyen',
  product_label VARCHAR(120) NOT NULL,
  amount_ht INT NOT NULL DEFAULT 0,
  tax_rate FLOAT NOT NULL DEFAULT 0,
  tax_amount INT NOT NULL DEFAULT 0,
  total_ttc INT NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  tax_free_reason VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_mdt_invoices_invoice_id (invoice_id),
  KEY idx_mdt_invoices_job (job_name),
  KEY idx_mdt_invoices_target (target_identifier)
);

CREATE TABLE IF NOT EXISTS mdt_partnerships (
  id INT NOT NULL AUTO_INCREMENT,
  job_name VARCHAR(60) NOT NULL,
  partner_name VARCHAR(120) NOT NULL,
  discount_rate FLOAT NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  notes VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mdt_partnerships_job (job_name)
);

CREATE TABLE IF NOT EXISTS mdt_commission_payouts (
  id INT NOT NULL AUTO_INCREMENT,
  job_name VARCHAR(60) NOT NULL,
  employee_identifier VARCHAR(60) NOT NULL,
  employee_name VARCHAR(120) NOT NULL,
  amount INT NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_mdt_commission_job (job_name),
  KEY idx_mdt_commission_employee (employee_identifier)
);

CREATE TABLE IF NOT EXISTS mdt_employee_stats (
  id INT NOT NULL AUTO_INCREMENT,
  job_name VARCHAR(60) NOT NULL,
  employee_identifier VARCHAR(60) NOT NULL,
  invoices_count INT NOT NULL DEFAULT 0,
  sales_total INT NOT NULL DEFAULT 0,
  commission_rate FLOAT NOT NULL DEFAULT 0.05,
  commission_due INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_mdt_employee_stats (job_name, employee_identifier)
);
