"use client";

import { useState } from "react";
import { EmployeeSelector } from "@/components/admin/employee-selector";
import { Card, Badge } from "@/components/ui";
import type { Role } from "@/generated/prisma/enums";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: { name: string } | null;
  isActive: boolean;
}

interface Props {
  employees: Employee[];
}

export function EmployeesClient({ employees }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = employees.find((e) => e.id === selectedId);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
        Employees
      </h2>

      <EmployeeSelector
        employees={employees}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {/* Employee list */}
      <div className="space-y-2">
        {employees.map((emp) => (
          <Card
            key={emp.id}
            className={`cursor-pointer transition-shadow hover:shadow-md ${
              emp.id === selectedId ? "ring-2 ring-blue-500" : ""
            }`}
          >
            <div onClick={() => setSelectedId(emp.id)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-sm">
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {emp.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {emp.email}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge>{emp.role.replace("_", " ")}</Badge>
                  {emp.department && (
                    <span className="text-[10px] text-gray-500">{emp.department.name}</span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
