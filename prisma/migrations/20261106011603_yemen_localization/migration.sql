-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "country" SET DEFAULT 'Yemen',
ALTER COLUMN "currency" SET DEFAULT 'YER',
ALTER COLUMN "timezone" SET DEFAULT 'Asia/Aden';

-- AlterTable
ALTER TABLE "employments" ALTER COLUMN "currency" SET DEFAULT 'YER';

-- AlterTable
ALTER TABLE "job_offers" ALTER COLUMN "currency" SET DEFAULT 'YER';

-- AlterTable
ALTER TABLE "job_vacancies" ALTER COLUMN "currency" SET DEFAULT 'YER';

-- AlterTable
ALTER TABLE "payroll_items" ALTER COLUMN "currency" SET DEFAULT 'YER';

-- AlterTable
ALTER TABLE "training_courses" ALTER COLUMN "currency" SET DEFAULT 'YER';

-- AlterTable
ALTER TABLE "work_locations" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Aden';
