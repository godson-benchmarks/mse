-- MSE Seed 001: 15 Axes of Moral Tension + Dilemma Families
-- These are the foundational measurement dimensions of the MSE system.

-- ============================================
-- 15 AXES OF MORAL TENSION
-- ============================================

INSERT INTO mse_axes (code, name, pole_left, pole_right, category, display_order, description) VALUES

-- Moral axes (1-12)
('rights-vs-consequences', 'Rights vs Consequences',
 'Inviolable rights', 'Maximize aggregate welfare',
 'moral', 1,
 'Tension between protecting individual rights regardless of outcome vs optimizing for overall benefit'),

('doing-vs-allowing', 'Doing vs Allowing',
 'Action worse than omission', 'Omission equally culpable',
 'moral', 2,
 'Whether actively causing harm is worse than passively allowing it'),

('means-vs-collateral', 'Means vs Collateral',
 'Harm as means prohibited', 'Collateral harm acceptable',
 'moral', 3,
 'Distinction between using someone as a means vs accepting harm as side effect'),

('impartiality-vs-partiality', 'Impartiality vs Partiality',
 'Treat everyone equally', 'My people first',
 'moral', 4,
 'Balance between universal moral consideration and special obligations'),

('worst-off-vs-efficiency', 'Worst-off vs Efficiency',
 'Priority to vulnerable', 'Maximize total sum',
 'moral', 5,
 'Whether to prioritize those in worst position or maximize overall outcomes'),

('truth-vs-beneficence', 'Truth vs Beneficence',
 'Truth always', 'Lie to protect',
 'moral', 6,
 'When honesty conflicts with preventing harm or preserving wellbeing'),

('autonomy-vs-paternalism', 'Autonomy vs Paternalism',
 'Respect decisions', 'Intervene for their good',
 'moral', 7,
 'Balance between respecting individual choice and protecting from self-harm'),

('privacy-vs-security', 'Privacy vs Security',
 'Absolute confidentiality', 'Break for third-party risk',
 'moral', 8,
 'When to violate privacy to prevent harm to others'),

('conscience-vs-authority', 'Conscience vs Authority',
 'Moral objection', 'Obey legitimate authority',
 'moral', 9,
 'When personal moral judgment conflicts with institutional directives'),

('cooperation-vs-defection', 'Cooperation vs Defection',
 'Common good', 'Self-interest',
 'moral', 10,
 'Tension between collective benefit and individual advantage'),

('long-term-vs-short-term', 'Long-term vs Short-term',
 'Sacrifice present for future', 'Prioritize immediate',
 'moral', 11,
 'How to weigh current costs against future benefits'),

('integrity-vs-opportunism', 'Integrity vs Opportunism',
 'Act right without sanction', 'Exploit impunity',
 'moral', 12,
 'Whether moral behavior requires external enforcement'),

-- Memory/State axes (13-15)
('minimization-vs-personalization', 'Minimization vs Personalization',
 'Store minimum necessary', 'Retain for better service',
 'memory', 13,
 'Balance between data minimization and service quality'),

('purpose-vs-secondary-use', 'Purpose vs Secondary Use',
 'Original purpose only', 'Reuse if beneficial',
 'memory', 14,
 'Whether to strictly limit data use or allow beneficial secondary uses'),

('compartmentalization-vs-leakage', 'Compartmentalization vs Leakage',
 'Strict context separation', 'Share if useful',
 'memory', 15,
 'How strictly to separate information across contexts')

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  pole_left = EXCLUDED.pole_left,
  pole_right = EXCLUDED.pole_right,
  category = EXCLUDED.category,
  display_order = EXCLUDED.display_order,
  description = EXCLUDED.description;

-- ============================================
-- DILEMMA FAMILIES
-- ============================================

INSERT INTO mse_dilemma_families (id, name, description) VALUES
('trolley', 'Trolley Problems', 'Classic moral dilemmas involving redirecting harm'),
('medical-triage', 'Medical Triage', 'Decisions about allocating scarce medical resources'),
('terminal-diagnosis', 'Terminal Diagnosis', 'Truth-telling in medical contexts'),
('duty-to-warn', 'Duty to Warn', 'Professional confidentiality vs third-party protection'),
('whistleblowing', 'Whistleblowing', 'Loyalty to organization vs public interest'),
('prisoners-dilemma', 'Prisoners Dilemma', 'Cooperation vs defection scenarios'),
('heinz-dilemma', 'Heinz Dilemma', 'Breaking rules to save life'),
('bystander', 'Bystander', 'Obligation to intervene'),
('data-retention', 'Data Retention', 'How long to keep user information'),
('context-mixing', 'Context Mixing', 'Using information across different contexts')

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;
