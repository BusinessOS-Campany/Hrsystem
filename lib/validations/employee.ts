import { z } from "zod";

export const employeeFormSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  firstNameAr: z.string().trim().max(80).optional(),
  lastNameAr: z.string().trim().max(80).optional(),
  email: z.string().trim().email(),
  phone: z.string().trim().max(30).optional(),
  gender: z.enum(["MALE", "FEMALE"]),
  nationalId: z.string().trim().max(30).optional(),
  dateOfBirth: z.string().optional(),
  nationality: z.string().trim().max(80).optional(),
  maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]).default("SINGLE"),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
  emergencyName: z.string().trim().max(120).optional(),
  emergencyPhone: z.string().trim().max(30).optional(),
  emergencyRelation: z.string().trim().max(60).optional(),
  branchId: z.string().min(1),
  departmentId: z.string().min(1),
  positionId: z.string().min(1),
  managerId: z.string().optional(),
  employmentType: z.enum([
    "FULL_TIME",
    "PART_TIME",
    "CONTRACT",
    "TEMPORARY",
    "INTERN",
  ]),
  hireDate: z.string().min(1),
  basicSalary: z.coerce.number().min(0).max(10000000),
  createAccount: z.boolean().default(false),
  roleCode: z.string().optional(),
});

export type EmployeeFormInput = z.infer<typeof employeeFormSchema>;
