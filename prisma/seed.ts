import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Role } from "../src/generated/prisma/enums";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.regularization.deleteMany();
  await prisma.dailySummary.deleteMany();
  await prisma.attendanceSession.deleteMany();
  await prisma.geoFence.deleteMany();
  await prisma.appConfig.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();

  // Create departments
  const engineering = await prisma.department.create({
    data: { name: "Engineering", code: "ENG" },
  });

  const hr = await prisma.department.create({
    data: { name: "Human Resources", code: "HR" },
  });

  const sales = await prisma.department.create({
    data: { name: "Sales", code: "SALES" },
  });

  const marketing = await prisma.department.create({
    data: { name: "Marketing", code: "MKT" },
  });

  console.log("✅ Departments created");

  // Hash password
  const hashedPassword = await bcrypt.hash("password123", 10);

  // Create Super Admin
  const superAdmin = await prisma.user.create({
    data: {
      email: "superadmin@demo.com",
      name: "Super Admin",
      password: hashedPassword,
      role: Role.SUPER_ADMIN,
      departmentId: engineering.id,
      phone: "+1234567890",
    },
  });

  // Create Admin
  const admin = await prisma.user.create({
    data: {
      email: "admin@demo.com",
      name: "Admin User",
      password: hashedPassword,
      role: Role.ADMIN,
      departmentId: engineering.id,
      phone: "+1234567891",
    },
  });

  // Create HR Admin
  const hrAdmin = await prisma.user.create({
    data: {
      email: "hr@demo.com",
      name: "HR Manager",
      password: hashedPassword,
      role: Role.HR_ADMIN,
      departmentId: hr.id,
      phone: "+1234567892",
    },
  });

  // Create Manager
  const manager = await prisma.user.create({
    data: {
      email: "manager@demo.com",
      name: "Team Manager",
      password: hashedPassword,
      role: Role.MANAGER,
      departmentId: engineering.id,
      phone: "+1234567893",
    },
  });

  // Create Employees
  const employees = await Promise.all([
    prisma.user.create({
      data: {
        email: "john@demo.com",
        name: "John Smith",
        password: hashedPassword,
        role: Role.EMPLOYEE,
        departmentId: engineering.id,
        managerId: manager.id,
        phone: "+1234567894",
      },
    }),
    prisma.user.create({
      data: {
        email: "jane@demo.com",
        name: "Jane Doe",
        password: hashedPassword,
        role: Role.EMPLOYEE,
        departmentId: engineering.id,
        managerId: manager.id,
        phone: "+1234567895",
      },
    }),
    prisma.user.create({
      data: {
        email: "bob@demo.com",
        name: "Bob Wilson",
        password: hashedPassword,
        role: Role.EMPLOYEE,
        departmentId: sales.id,
        managerId: manager.id,
        phone: "+1234567896",
      },
    }),
    prisma.user.create({
      data: {
        email: "alice@demo.com",
        name: "Alice Johnson",
        password: hashedPassword,
        role: Role.EMPLOYEE,
        departmentId: marketing.id,
        managerId: manager.id,
        phone: "+1234567897",
      },
    }),
    prisma.user.create({
      data: {
        email: "charlie@demo.com",
        name: "Charlie Brown",
        password: hashedPassword,
        role: Role.EMPLOYEE,
        departmentId: hr.id,
        managerId: hrAdmin.id,
        phone: "+1234567898",
      },
    }),
  ]);

  console.log("✅ Users created");

  // Create Geofence
  await prisma.geoFence.create({
    data: {
      name: "Main Office",
      latitude: 12.9716,  // Bangalore example
      longitude: 77.5946,
      radiusM: 500,
      isActive: true,
    },
  });

  await prisma.geoFence.create({
    data: {
      name: "Branch Office",
      latitude: 12.9352,
      longitude: 77.6245,
      radiusM: 300,
      isActive: true,
    },
  });

  console.log("✅ Geofences created");

  // Create sample attendance for John (last 7 days)
  const john = employees[0];
  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(0, 0, 0, 0);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const checkInTime = new Date(date);
    checkInTime.setHours(9, Math.floor(Math.random() * 30), 0, 0);

    const checkOutTime = new Date(date);
    checkOutTime.setHours(17 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0);

    await prisma.attendanceSession.create({
      data: {
        userId: john.id,
        type: "CHECK_IN",
        timestamp: checkInTime,
        latitude: 12.9716 + (Math.random() - 0.5) * 0.001,
        longitude: 77.5946 + (Math.random() - 0.5) * 0.001,
      },
    });

    await prisma.attendanceSession.create({
      data: {
        userId: john.id,
        type: "CHECK_OUT",
        timestamp: checkOutTime,
        latitude: 12.9716 + (Math.random() - 0.5) * 0.001,
        longitude: 77.5946 + (Math.random() - 0.5) * 0.001,
      },
    });

    const workMins = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 60000);
    const isLate = checkInTime.getHours() >= 9 && checkInTime.getMinutes() > 30;

    await prisma.dailySummary.create({
      data: {
        userId: john.id,
        date,
        firstCheckIn: checkInTime,
        lastCheckOut: checkOutTime,
        totalWorkMins: workMins,
        totalBreakMins: 0,
        overtimeMins: Math.max(0, workMins - 480),
        sessionCount: 2,
        status: isLate ? "LATE" : "PRESENT",
      },
    });
  }

  console.log("✅ Sample attendance created for John");

  // Create sample regularization
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  twoDaysAgo.setHours(0, 0, 0, 0);

  await prisma.regularization.create({
    data: {
      employeeId: john.id,
      date: twoDaysAgo,
      type: "MISSED_CHECK_OUT",
      reason: "Forgot to check out due to urgent meeting",
      status: "PENDING",
    },
  });

  console.log("✅ Sample regularization created");

  // Create app config
  await prisma.appConfig.createMany({
    data: [
      { key: "STANDARD_WORK_HOURS", value: "8" },
      { key: "LATE_THRESHOLD", value: "09:30" },
      { key: "AUTO_CHECKOUT_HOUR", value: "23" },
      { key: "DEFAULT_GEOFENCE_RADIUS", value: "200" },
    ],
  });

  console.log("✅ App config created");
  console.log("\n🎉 Seed completed successfully!\n");
  console.log("Demo accounts (all use password: password123):");
  console.log("  Super Admin:  superadmin@demo.com");
  console.log("  Admin:        admin@demo.com");
  console.log("  HR Admin:     hr@demo.com");
  console.log("  Manager:      manager@demo.com");
  console.log("  Employee:     john@demo.com / jane@demo.com / bob@demo.com");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
