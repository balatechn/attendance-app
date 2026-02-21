"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui";

interface Employee {
  id: string;
  name: string;
  email: string;
  department?: { name: string } | null;
}

interface Props {
  employees: Employee[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function EmployeeSelector({ employees, selectedId, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const departments = useMemo(() => {
    const deps = new Set<string>();
    employees.forEach((e) => {
      if (e.department?.name) deps.add(e.department.name);
    });
    return Array.from(deps).sort();
  }, [employees]);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const matchesSearch =
        search === "" ||
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase());
      const matchesDept =
        departmentFilter === "" || e.department?.name === departmentFilter;
      return matchesSearch && matchesDept;
    });
  }, [employees, search, departmentFilter]);

  const selected = employees.find((e) => e.id === selectedId);

  return (
    <div className="relative">
      {/* Selected display / toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-left hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
      >
        <span className={selected ? "text-gray-900 dark:text-white" : "text-gray-400"}>
          {selected ? `${selected.name} (${selected.email})` : "Select employee..."}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-80 overflow-hidden">
          <div className="p-2 space-y-2 border-b border-gray-200 dark:border-gray-700">
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm"
            />
            {departments.length > 0 && (
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-3 text-sm text-gray-400 text-center">No employees found</p>
            ) : (
              filtered.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => {
                    onSelect(emp.id);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    emp.id === selectedId ? "bg-blue-50 dark:bg-blue-900/20" : ""
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-300">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {emp.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {emp.email}
                      {emp.department?.name && ` · ${emp.department.name}`}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
