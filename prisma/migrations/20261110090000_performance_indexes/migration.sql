-- Read-path indexes for HRSYS.
-- Safe/reversible: this migration only adds extensions and indexes; it never
-- changes or deletes existing rows. Index names use IF NOT EXISTS so it can be
-- re-run safely after an out-of-band CONCURRENTLY deployment.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Composite indexes used by list, dashboard, report and approval screens.
CREATE INDEX IF NOT EXISTS employees_deleted_status_no_idx
  ON public.employees ("deletedAt", status, "employeeNo");

CREATE INDEX IF NOT EXISTS employments_current_department_idx
  ON public.employments ("isCurrent", "departmentId");

CREATE INDEX IF NOT EXISTS employments_current_contract_end_idx
  ON public.employments ("isCurrent", "contractEnd");

CREATE INDEX IF NOT EXISTS leave_requests_status_start_idx
  ON public.leave_requests (status, "startDate");

CREATE INDEX IF NOT EXISTS payroll_runs_created_idx
  ON public.payroll_runs ("createdAt");

CREATE INDEX IF NOT EXISTS job_vacancies_status_created_idx
  ON public.job_vacancies (status, "createdAt");

CREATE INDEX IF NOT EXISTS candidate_applications_applied_idx
  ON public.candidate_applications ("appliedAt");

CREATE INDEX IF NOT EXISTS training_courses_start_created_idx
  ON public.training_courses ("startDate", "createdAt");

CREATE INDEX IF NOT EXISTS employee_requests_status_created_idx
  ON public.employee_requests (status, "createdAt");

-- Trigram indexes for the case-insensitive "contains" searches used by global
-- search and list filters. Without these, ILIKE '%term%' cannot use a B-tree.
CREATE INDEX IF NOT EXISTS employees_first_name_trgm_idx
  ON public.employees USING GIN ("firstName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS employees_last_name_trgm_idx
  ON public.employees USING GIN ("lastName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS employees_first_name_ar_trgm_idx
  ON public.employees USING GIN ("firstNameAr" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS employees_last_name_ar_trgm_idx
  ON public.employees USING GIN ("lastNameAr" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS employees_employee_no_trgm_idx
  ON public.employees USING GIN ("employeeNo" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS employees_email_trgm_idx
  ON public.employees USING GIN (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS employees_personal_email_trgm_idx
  ON public.employees USING GIN ("personalEmail" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS employees_phone_trgm_idx
  ON public.employees USING GIN (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS employees_national_id_trgm_idx
  ON public.employees USING GIN ("nationalId" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS departments_name_trgm_idx
  ON public.departments USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS departments_name_ar_trgm_idx
  ON public.departments USING GIN ("nameAr" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS departments_code_trgm_idx
  ON public.departments USING GIN (code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS departments_description_trgm_idx
  ON public.departments USING GIN (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS positions_name_trgm_idx
  ON public.positions USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS positions_name_ar_trgm_idx
  ON public.positions USING GIN ("nameAr" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS positions_code_trgm_idx
  ON public.positions USING GIN (code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS positions_grade_trgm_idx
  ON public.positions USING GIN (grade gin_trgm_ops);
CREATE INDEX IF NOT EXISTS positions_description_trgm_idx
  ON public.positions USING GIN (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS leave_requests_request_no_trgm_idx
  ON public.leave_requests USING GIN ("requestNo" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS leave_requests_reason_trgm_idx
  ON public.leave_requests USING GIN (reason gin_trgm_ops);

CREATE INDEX IF NOT EXISTS leave_types_name_trgm_idx
  ON public.leave_types USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS leave_types_name_ar_trgm_idx
  ON public.leave_types USING GIN ("nameAr" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS leave_types_code_trgm_idx
  ON public.leave_types USING GIN (code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS payroll_runs_run_no_trgm_idx
  ON public.payroll_runs USING GIN ("runNo" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS payroll_runs_notes_trgm_idx
  ON public.payroll_runs USING GIN (notes gin_trgm_ops);
CREATE INDEX IF NOT EXISTS payroll_periods_name_trgm_idx
  ON public.payroll_periods USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS employee_requests_request_no_trgm_idx
  ON public.employee_requests USING GIN ("requestNo" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS employee_requests_subject_trgm_idx
  ON public.employee_requests USING GIN (subject gin_trgm_ops);
CREATE INDEX IF NOT EXISTS employee_requests_details_trgm_idx
  ON public.employee_requests USING GIN (details gin_trgm_ops);

CREATE INDEX IF NOT EXISTS assets_asset_tag_trgm_idx
  ON public.assets USING GIN ("assetTag" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS assets_name_trgm_idx
  ON public.assets USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS assets_category_trgm_idx
  ON public.assets USING GIN (category gin_trgm_ops);
CREATE INDEX IF NOT EXISTS assets_brand_trgm_idx
  ON public.assets USING GIN (brand gin_trgm_ops);
CREATE INDEX IF NOT EXISTS assets_model_trgm_idx
  ON public.assets USING GIN (model gin_trgm_ops);
CREATE INDEX IF NOT EXISTS assets_serial_number_trgm_idx
  ON public.assets USING GIN ("serialNumber" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS users_name_trgm_idx
  ON public.users USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_name_ar_trgm_idx
  ON public.users USING GIN ("nameAr" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_username_trgm_idx
  ON public.users USING GIN (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_email_trgm_idx
  ON public.users USING GIN (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS job_vacancies_title_trgm_idx
  ON public.job_vacancies USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS job_vacancies_title_ar_trgm_idx
  ON public.job_vacancies USING GIN ("titleAr" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS job_vacancies_description_trgm_idx
  ON public.job_vacancies USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS job_vacancies_requirements_trgm_idx
  ON public.job_vacancies USING GIN (requirements gin_trgm_ops);

CREATE INDEX IF NOT EXISTS candidates_first_name_trgm_idx
  ON public.candidates USING GIN ("firstName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS candidates_last_name_trgm_idx
  ON public.candidates USING GIN ("lastName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS candidates_email_trgm_idx
  ON public.candidates USING GIN (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS candidates_phone_trgm_idx
  ON public.candidates USING GIN (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS training_courses_code_trgm_idx
  ON public.training_courses USING GIN (code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS training_courses_title_trgm_idx
  ON public.training_courses USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS training_courses_title_ar_trgm_idx
  ON public.training_courses USING GIN ("titleAr" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS training_courses_description_trgm_idx
  ON public.training_courses USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS training_courses_provider_trgm_idx
  ON public.training_courses USING GIN (provider gin_trgm_ops);
CREATE INDEX IF NOT EXISTS training_courses_trainer_trgm_idx
  ON public.training_courses USING GIN (trainer gin_trgm_ops);
CREATE INDEX IF NOT EXISTS training_courses_category_trgm_idx
  ON public.training_courses USING GIN (category gin_trgm_ops);
