"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Card } from "@/components/ui";
import Image from "next/image";

export default function ChangePasswordPage() {
  const [isForced, setIsForced] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((session) => {
        setIsForced(session?.user?.mustChangePassword === true);
      })
      .catch(() => setIsForced(false));
  }, []);

  if (isForced === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-950 dark:to-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return <ChangePasswordForm isForced={isForced} />;
}

interface Props {
  isForced?: boolean;
}

export function ChangePasswordForm({ isForced = false }: Props) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: isForced ? undefined : currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || "Failed to change password");
        return;
      }

      setSuccess(true);
      setTimeout(async () => {
        if (isForced) {
          // Sign out and redirect to login so JWT refreshes with mustChangePassword=false
          const { signOut } = await import("next-auth/react");
          await signOut({ redirect: false });
          router.push("/login");
        } else {
          router.push("/dashboard");
        }
        router.refresh();
      }, 1500);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-950 dark:to-gray-900">
        <Card className="max-w-sm w-full text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <svg className="w-7 h-7 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Password Changed!</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isForced ? "Redirecting to login..." : "Redirecting to dashboard..."}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-950 dark:to-gray-900">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Image src="/logo.webp" alt="Logo" width={56} height={56} className="mx-auto rounded-xl shadow mb-3" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            {isForced ? "Set Your New Password" : "Change Password"}
          </h1>
          {isForced && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
              You must change your temporary password before continuing
            </p>
          )}
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isForced && (
              <Input
                label="Current Password"
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            )}
            <Input
              label="New Password"
              type="password"
              placeholder="Min 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Input
              label="Confirm New Password"
              type="password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full" size="lg">
              {isForced ? "Set Password & Continue" : "Change Password"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
