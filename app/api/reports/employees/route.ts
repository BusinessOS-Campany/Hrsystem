import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, hasPermission } from "@/lib/auth/session";

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "report.view")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const employees = await prisma.employee.findMany({
    where: { deletedAt: null },
    include: {
      employments: {
        where: { isCurrent: true },
        include: { department: true, position: true, branch: true },
        take: 1,
      },
    },
    orderBy: { employeeNo: "asc" },
  });

  const header = [
    "Employee No",
    "First Name",
    "Last Name",
    "Email",
    "Phone",
    "Department",
    "Position",
    "Branch",
    "Status",
    "Hire Date",
  ];

  const lines = employees.map((employee) => {
    const employment = employee.employments[0];
    return [
      employee.employeeNo,
      employee.firstName,
      employee.lastName,
      employee.email,
      employee.phone,
      employment?.department.name,
      employment?.position.name,
      employment?.branch.name,
      employee.status,
      employee.hireDate.toISOString().slice(0, 10),
    ]
      .map(escapeCsv)
      .join(",");
  });

  const csv = `\uFEFF${[header.map(escapeCsv).join(","), ...lines].join("\r\n")}`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hrsys-employees-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
