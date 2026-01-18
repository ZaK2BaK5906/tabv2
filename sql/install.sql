-- ============================================
-- MDT PREMIUM - INSTALLATION SQL COMPLETE
-- Version: 1.0.0
-- ============================================

-- IMPORTANT: Executez ce script sur votre base de donnees ESX
-- Assurez-vous d'avoir les tables ESX de base (users, jobs, addon_account_data, etc.)

-- ============================================
-- PARAMETRES DE TAXES
-- ============================================

CREATE TABLE IF NOT EXISTS mdt_tax_settings (
  id INT NOT NULL AUTO_INCREMENT,
  default_rate FLOAT NOT NULL DEFAULT 0.15,
  allow_tax_free TINYINT(1) NOT NULL DEFAULT 1,
  allow_doj_tax_free TINYINT(1) NOT NULL DEFAULT 1,
  max_tax_free_invoice INT NOT NULL DEFAULT 10000,
  alert_threshold_tax_free INT NOT NULL DEFAULT 5,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Insert default settings
INSERT INTO mdt_tax_settings (default_rate, allow_tax_free, allow_doj_tax_free, max_tax_free_invoice, alert_threshold_tax_free)
VALUES (0.15, 1, 1, 10000, 5)
ON DUPLICATE KEY UPDATE id=id;

-- ============================================
-- REGLES DE TAXES PAR ENTREPRISE
-- ============================================

CREATE TABLE IF NOT EXISTS mdt_tax_rules (
  id INT NOT NULL AUTO_INCREMENT,
  job_name VARCHAR(60) NOT NULL,
  rate FLOAT NOT NULL DEFAULT 0.15,
  allow_tax_free TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_mdt_tax_rules_job (job_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================
-- PRODUITS / CATALOGUE
-- ============================================

CREATE TABLE IF NOT EXISTS mdt_products (
  id INT NOT NULL AUTO_INCREMENT,
  job_name VARCHAR(60) NOT NULL,
  label VARCHAR(120) NOT NULL,
  price INT NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mdt_products_job (job_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================
-- FACTURES
-- ============================================

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
  KEY idx_mdt_invoices_target (target_identifier),
  KEY idx_mdt_invoices_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================
-- PARTENARIATS
-- ============================================

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================
-- PAIEMENTS DE COMMISSIONS
-- ============================================

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
  KEY idx_mdt_commission_employee (employee_identifier),
  KEY idx_mdt_commission_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================
-- STATISTIQUES EMPLOYES
-- ============================================

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================
-- ACTIONS DOJ (Amendes, Gels, etc.)
-- ============================================

CREATE TABLE IF NOT EXISTS mdt_doj_actions (
  id INT NOT NULL AUTO_INCREMENT,
  job_name VARCHAR(60) NOT NULL,
  action_type VARCHAR(40) NOT NULL,
  amount INT NOT NULL DEFAULT 0,
  reason VARCHAR(255) DEFAULT NULL,
  agent_identifier VARCHAR(60) DEFAULT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_mdt_doj_job (job_name),
  KEY idx_mdt_doj_type (action_type),
  KEY idx_mdt_doj_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================
-- CODE PENAL - ARTICLES DE LOI
-- ============================================

CREATE TABLE IF NOT EXISTS mdt_penal_code (
  id INT NOT NULL AUTO_INCREMENT,
  article_number VARCHAR(20) NOT NULL,
  category VARCHAR(60) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  min_fine INT NOT NULL DEFAULT 0,
  max_fine INT NOT NULL DEFAULT 0,
  min_jail INT NOT NULL DEFAULT 0,
  max_jail INT NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  vote_status VARCHAR(40) NOT NULL DEFAULT 'pending',
  votes_for INT NOT NULL DEFAULT 0,
  votes_against INT NOT NULL DEFAULT 0,
  vote_deadline TIMESTAMP NULL DEFAULT NULL,
  created_by VARCHAR(60) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  validated_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_article_number (article_number),
  KEY idx_penal_category (category),
  KEY idx_penal_status (status),
  KEY idx_penal_vote_status (vote_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================
-- CODE PENAL - VOTES CITOYENS
-- ============================================

CREATE TABLE IF NOT EXISTS mdt_penal_votes (
  id INT NOT NULL AUTO_INCREMENT,
  article_id INT NOT NULL,
  citizen_identifier VARCHAR(60) NOT NULL,
  citizen_name VARCHAR(120) NOT NULL,
  vote ENUM('for', 'against') NOT NULL,
  comment TEXT DEFAULT NULL,
  voted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_citizen_vote (article_id, citizen_identifier),
  KEY idx_vote_article (article_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================
-- CODE PENAL - CATEGORIES
-- ============================================

CREATE TABLE IF NOT EXISTS mdt_penal_categories (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(60) NOT NULL,
  label VARCHAR(120) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  display_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_category_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Insert default categories
INSERT INTO mdt_penal_categories (name, label, description, display_order) VALUES
('infractions', 'Infractions', 'Infractions mineures et contraventions', 1),
('delits', 'Delits', 'Delits et crimes mineurs', 2),
('crimes', 'Crimes', 'Crimes graves', 3),
('circulation', 'Code de la route', 'Infractions routieres', 4),
('economique', 'Crimes economiques', 'Fraude, blanchiment, evasion fiscale', 5)
ON DUPLICATE KEY UPDATE label=VALUES(label);

-- ============================================
-- COMPTE SOCIETE DOJ (si n'existe pas)
-- ============================================

INSERT INTO addon_account_data (account_name, money, owner)
SELECT 'society_doj', 0, NULL
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM addon_account_data WHERE account_name = 'society_doj'
);

-- ============================================
-- JOB DOJ (si n'existe pas)
-- ============================================

INSERT INTO jobs (name, label)
SELECT 'doj', 'Department of Justice'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM jobs WHERE name = 'doj'
);

INSERT INTO job_grades (job_name, grade, name, label, salary)
SELECT 'doj', 0, 'agent', 'Agent DOJ', 500
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM job_grades WHERE job_name = 'doj' AND grade = 0
);

INSERT INTO job_grades (job_name, grade, name, label, salary)
SELECT 'doj', 1, 'senior', 'Agent Senior', 750
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM job_grades WHERE job_name = 'doj' AND grade = 1
);

INSERT INTO job_grades (job_name, grade, name, label, salary)
SELECT 'doj', 2, 'supervisor', 'Superviseur', 1000
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM job_grades WHERE job_name = 'doj' AND grade = 2
);

INSERT INTO job_grades (job_name, grade, name, label, salary)
SELECT 'doj', 3, 'boss', 'Directeur DOJ', 1500
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM job_grades WHERE job_name = 'doj' AND grade = 3
);

-- ============================================
-- AJOUT COLONNE STOCK DANS VEHICLES (pour concession)
-- Note: Execute separement si erreur
-- ============================================

-- ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS stock INT NOT NULL DEFAULT 0;

-- ============================================
-- FIN DE L'INSTALLATION
-- ============================================

SELECT 'Installation MDT terminee avec succes!' AS message;
