import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, type AuthUser } from "@/lib/auth/session";
import { formatDate, localizedName } from "@/lib/format";
import type { SearchGroup } from "./types";

type SearchOptions = {
  user: AuthUser;
  locale: string;
  query: string;
  limit?: number;
};

const DEFAULT_LIMIT = 5;

function buildSubtitle(...parts: Array<string | null | undefined>) {
  return parts.filter((part) => Boolean(part && part.trim())).join(" · ");
}

function employeeName(
  employee: {
    firstName: string;
    lastName: string;
    firstNameAr: string | null;
    lastNameAr: string | null;
  },
  locale: string,
) {
  return localizedName(
    locale,
    `${employee.firstName} ${employee.lastName}`,
    `${employee.firstNameAr ?? ""} ${employee.lastNameAr ?? ""}`.trim(),
  );
}

function none() {
  return "__none__";
}

async function searchEmployees(
  user: AuthUser,
  query: string,
  locale: string,
  limit: number,
): Promise<SearchGroup | null> {
  if (!hasPermission(user, "employee.view")) return null;

  const scope: Prisma.EmployeeWhereInput = hasPermission(user, "employee.view_all")
    ? {}
    : user.employeeId
      ? { OR: [{ id: user.employeeId }, { managerId: user.employeeId }] }
      : { id: none() };

  const employees = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      AND: [
        scope,
        {
          OR: [
            { employeeNo: { contains: query, mode: "insensitive" } },
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { firstNameAr: { contains: query, mode: "insensitive" } },
            { lastNameAr: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { personalEmail: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
            { nationalId: { contains: query, mode: "insensitive" } },
          ],
        },
      ],
    },
    include: {
      employments: {
        where: { isCurrent: true },
        include: { department: true, position: true },
        take: 1,
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: limit,
  });

  if (employees.length === 0) return null;

  return {
    key: "employees",
    results: employees.map((employee) => {
      const employment = employee.employments[0];
      return {
        id: employee.id,
        title: employeeName(employee, locale),
        subtitle: buildSubtitle(
          employee.employeeNo,
          employment
            ? localizedName(
                locale,
                employment.department.name,
                employment.department.nameAr,
              )
            : null,
          employment
            ? localizedName(locale, employment.position.name, employment.position.nameAr)
            : null,
        ),
        href: `/employees/${employee.id}`,
      };
    }),
  };
}

async function searchDepartments(
  user: AuthUser,
  query: string,
  locale: string,
  limit: number,
): Promise<SearchGroup | null> {
  if (!hasPermission(user, "department.view")) return null;

  const departments = await prisma.department.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { nameAr: { contains: query, mode: "insensitive" } },
        { code: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { name: "asc" },
    take: limit,
  });

  if (departments.length === 0) return null;

  return {
    key: "departments",
    results: departments.map((department) => ({
      id: department.id,
      title: localizedName(locale, department.name, department.nameAr),
      subtitle: department.code,
      href: `/departments?q=${encodeURIComponent(department.code)}`,
    })),
  };
}

async function searchPositions(
  user: AuthUser,
  query: string,
  locale: string,
  limit: number,
): Promise<SearchGroup | null> {
  if (!hasPermission(user, "position.view")) return null;

  const positions = await prisma.position.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { nameAr: { contains: query, mode: "insensitive" } },
        { code: { contains: query, mode: "insensitive" } },
        { grade: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    },
    include: { department: true },
    orderBy: { name: "asc" },
    take: limit,
  });

  if (positions.length === 0) return null;

  return {
    key: "positions",
    results: positions.map((position) => ({
      id: position.id,
      title: localizedName(locale, position.name, position.nameAr),
      subtitle: buildSubtitle(
        position.code,
        localizedName(
          locale,
          position.department.name,
          position.department.nameAr,
        ),
      ),
      href: `/positions?q=${encodeURIComponent(position.code)}`,
    })),
  };
}

async function searchLeave(
  user: AuthUser,
  query: string,
  locale: string,
  limit: number,
): Promise<SearchGroup | null> {
  if (!hasPermission(user, "leave.view")) return null;

  const scope: Prisma.LeaveRequestWhereInput = hasPermission(user, "leave.view_all")
    ? {}
    : user.employeeId
      ? { OR: [{ employeeId: user.employeeId }, { managerId: user.employeeId }] }
      : { id: none() };

  const requests = await prisma.leaveRequest.findMany({
    where: {
      AND: [
        scope,
        {
          OR: [
            { requestNo: { contains: query, mode: "insensitive" } },
            { reason: { contains: query, mode: "insensitive" } },
            {
              employee: {
                is: {
                  OR: [
                    { employeeNo: { contains: query, mode: "insensitive" } },
                    { firstName: { contains: query, mode: "insensitive" } },
                    { lastName: { contains: query, mode: "insensitive" } },
                    { firstNameAr: { contains: query, mode: "insensitive" } },
                    { lastNameAr: { contains: query, mode: "insensitive" } },
                  ],
                },
              },
            },
            {
              leaveType: {
                is: {
                  OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { nameAr: { contains: query, mode: "insensitive" } },
                    { code: { contains: query, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        },
      ],
    },
    include: { employee: true, leaveType: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  if (requests.length === 0) return null;

  return {
    key: "leave",
    results: requests.map((request) => ({
      id: request.id,
      title: request.requestNo,
      subtitle: buildSubtitle(
        employeeName(request.employee, locale),
        localizedName(locale, request.leaveType.name, request.leaveType.nameAr),
        `${formatDate(request.startDate, locale)} – ${formatDate(request.endDate, locale)}`,
      ),
      href: `/leave?q=${encodeURIComponent(request.requestNo)}`,
    })),
  };
}

async function searchPayroll(
  user: AuthUser,
  query: string,
  locale: string,
  limit: number,
): Promise<SearchGroup | null> {
  if (!hasPermission(user, "payroll.view")) return null;

  const scope: Prisma.PayrollRunWhereInput = hasPermission(user, "payroll.view_all")
    ? {}
    : user.employeeId
      ? { items: { some: { employeeId: user.employeeId } } }
      : { id: none() };

  const runs = await prisma.payrollRun.findMany({
    where: {
      AND: [
        scope,
        {
          OR: [
            { runNo: { contains: query, mode: "insensitive" } },
            { notes: { contains: query, mode: "insensitive" } },
            { period: { is: { name: { contains: query, mode: "insensitive" } } } },
          ],
        },
      ],
    },
    include: { period: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  if (runs.length === 0) return null;

  return {
    key: "payroll",
    results: runs.map((run) => ({
      id: run.id,
      title: run.runNo,
      subtitle: buildSubtitle(run.period.name, formatDate(run.period.payDate, locale)),
      href: `/payroll/${run.id}`,
    })),
  };
}

async function searchRequests(
  user: AuthUser,
  query: string,
  locale: string,
  limit: number,
): Promise<SearchGroup | null> {
  if (!hasPermission(user, "request.view")) return null;

  const scope: Prisma.EmployeeRequestWhereInput = hasPermission(
    user,
    "request.view_all",
  )
    ? {}
    : user.employeeId
      ? {
          employee: {
            is: {
              OR: [{ id: user.employeeId }, { managerId: user.employeeId }],
            },
          },
        }
      : { id: none() };

  const requests = await prisma.employeeRequest.findMany({
    where: {
      AND: [
        scope,
        {
          OR: [
            { requestNo: { contains: query, mode: "insensitive" } },
            { subject: { contains: query, mode: "insensitive" } },
            { details: { contains: query, mode: "insensitive" } },
            {
              employee: {
                is: {
                  OR: [
                    { employeeNo: { contains: query, mode: "insensitive" } },
                    { firstName: { contains: query, mode: "insensitive" } },
                    { lastName: { contains: query, mode: "insensitive" } },
                    { firstNameAr: { contains: query, mode: "insensitive" } },
                    { lastNameAr: { contains: query, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        },
      ],
    },
    include: { employee: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  if (requests.length === 0) return null;

  return {
    key: "requests",
    results: requests.map((request) => ({
      id: request.id,
      title: request.requestNo,
      subtitle: buildSubtitle(
        employeeName(request.employee, locale),
        request.subject,
      ),
      href: `/requests?q=${encodeURIComponent(request.requestNo)}`,
    })),
  };
}

async function searchAssets(
  user: AuthUser,
  query: string,
  locale: string,
  limit: number,
): Promise<SearchGroup | null> {
  if (!hasPermission(user, "asset.view")) return null;

  const canViewAll =
    hasPermission(user, "asset.manage") ||
    hasPermission(user, "employee.view_all");

  const scope: Prisma.AssetWhereInput = canViewAll
    ? {}
    : {
        assignments: {
          some: {
            employeeId: user.employeeId ?? none(),
            returnedAt: null,
          },
        },
      };

  const assets = await prisma.asset.findMany({
    where: {
      deletedAt: null,
      AND: [
        scope,
        {
          OR: [
            { assetTag: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
            { category: { contains: query, mode: "insensitive" } },
            { brand: { contains: query, mode: "insensitive" } },
            { model: { contains: query, mode: "insensitive" } },
            { serialNumber: { contains: query, mode: "insensitive" } },
          ],
        },
      ],
    },
    orderBy: { assetTag: "asc" },
    take: limit,
  });

  if (assets.length === 0) return null;

  return {
    key: "assets",
    results: assets.map((asset) => ({
      id: asset.id,
      title: asset.name,
      subtitle: buildSubtitle(asset.assetTag, asset.category),
      href: `/assets?q=${encodeURIComponent(asset.assetTag)}`,
    })),
  };
}

async function searchUsers(
  user: AuthUser,
  query: string,
  locale: string,
  limit: number,
): Promise<SearchGroup | null> {
  if (!hasPermission(user, "user.manage")) return null;

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { nameAr: { contains: query, mode: "insensitive" } },
        { username: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { name: "asc" },
    take: limit,
  });

  if (users.length === 0) return null;

  return {
    key: "users",
    results: users.map((account) => ({
      id: account.id,
      title: localizedName(locale, account.name, account.nameAr),
      subtitle: buildSubtitle(`@${account.username}`, account.email),
      href: `/users?q=${encodeURIComponent(account.username)}`,
    })),
  };
}

async function searchRecruitment(
  user: AuthUser,
  query: string,
  locale: string,
  limit: number,
): Promise<SearchGroup | null> {
  if (!hasPermission(user, "recruitment.view")) return null;

  const [vacancies, applications] = await Promise.all([
    prisma.jobVacancy.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { titleAr: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { requirements: { contains: query, mode: "insensitive" } },
        ],
      },
      include: { department: true, position: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.candidateApplication.findMany({
      where: {
        OR: [
          {
            candidate: {
              is: {
                OR: [
                  { firstName: { contains: query, mode: "insensitive" } },
                  { lastName: { contains: query, mode: "insensitive" } },
                  { email: { contains: query, mode: "insensitive" } },
                  { phone: { contains: query, mode: "insensitive" } },
                ],
              },
            },
          },
          {
            vacancy: {
              is: {
                OR: [
                  { title: { contains: query, mode: "insensitive" } },
                  { titleAr: { contains: query, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      },
      include: {
        candidate: true,
        vacancy: { include: { department: true, position: true } },
      },
      orderBy: { appliedAt: "desc" },
      take: limit,
    }),
  ]);

  const results = [
    ...vacancies.map((vacancy) => ({
      id: `vacancy-${vacancy.id}`,
      title: localizedName(locale, vacancy.title, vacancy.titleAr),
      subtitle: buildSubtitle(
        localizedName(locale, vacancy.department.name, vacancy.department.nameAr),
        localizedName(locale, vacancy.position.name, vacancy.position.nameAr),
      ),
      href: `/recruitment?q=${encodeURIComponent(vacancy.title)}`,
    })),
    ...applications.map((application) => ({
      id: `application-${application.id}`,
      title: `${application.candidate.firstName} ${application.candidate.lastName}`,
      subtitle: buildSubtitle(
        localizedName(
          locale,
          application.vacancy.title,
          application.vacancy.titleAr,
        ),
        application.candidate.email,
      ),
      href: `/recruitment?q=${encodeURIComponent(
        `${application.candidate.firstName} ${application.candidate.lastName}`,
      )}`,
    })),
  ].slice(0, limit);

  if (results.length === 0) return null;

  return { key: "recruitment", results };
}

async function searchTraining(
  user: AuthUser,
  query: string,
  locale: string,
  limit: number,
): Promise<SearchGroup | null> {
  if (!hasPermission(user, "training.view")) return null;

  const courses = await prisma.trainingCourse.findMany({
    where: {
      OR: [
        { code: { contains: query, mode: "insensitive" } },
        { title: { contains: query, mode: "insensitive" } },
        { titleAr: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { provider: { contains: query, mode: "insensitive" } },
        { trainer: { contains: query, mode: "insensitive" } },
        { category: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  if (courses.length === 0) return null;

  return {
    key: "training",
    results: courses.map((course) => ({
      id: course.id,
      title: localizedName(locale, course.title, course.titleAr),
      subtitle: buildSubtitle(course.code, course.provider, course.trainer),
      href: `/training?q=${encodeURIComponent(course.code)}`,
    })),
  };
}

export async function searchAll({
  user,
  locale,
  query,
  limit = DEFAULT_LIMIT,
}: SearchOptions): Promise<SearchGroup[]> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length === 0) return [];

  const resultLimit = Math.min(Math.max(limit, 1), 25);
  const groups = await Promise.all([
    searchEmployees(user, normalizedQuery, locale, resultLimit),
    searchDepartments(user, normalizedQuery, locale, resultLimit),
    searchPositions(user, normalizedQuery, locale, resultLimit),
    searchLeave(user, normalizedQuery, locale, resultLimit),
    searchPayroll(user, normalizedQuery, locale, resultLimit),
    searchRequests(user, normalizedQuery, locale, resultLimit),
    searchAssets(user, normalizedQuery, locale, resultLimit),
    searchUsers(user, normalizedQuery, locale, resultLimit),
    searchRecruitment(user, normalizedQuery, locale, resultLimit),
    searchTraining(user, normalizedQuery, locale, resultLimit),
  ]);

  return groups.filter((group): group is SearchGroup => Boolean(group));
}
