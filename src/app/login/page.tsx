"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button, Input, Card } from "@/components/ui";

type View = "login" | "forgot-email" | "forgot-code" | "forgot-done";

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("login");

  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid email or password");
      } else {
        // Check session to see if password change is required
        const sessionRes = await fetch("/api/auth/session");
        const session = await sessionRes.json();
        if (session?.user?.mustChangePassword) {
          router.push("/change-password");
        } else {
          router.push("/dashboard");
        }
        router.refresh();
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetMsg("");
    setResetLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();

      if (!res.ok) {
        setResetError(data.error || "Failed to send reset code");
      } else {
        setResetMsg("Reset code sent to your email");
        setView("forgot-code");
      }
    } catch {
      setResetError("Something went wrong");
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetMsg("");

    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setResetError("Password must be at least 8 characters");
      return;
    }

    setResetLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail, code: resetCode, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setResetError(data.error || "Failed to reset password");
      } else {
        setView("forgot-done");
      }
    } catch {
      setResetError("Something went wrong");
    } finally {
      setResetLoading(false);
    }
  };

  const resetForgotState = () => {
    setView("login");
    setResetEmail("");
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
    setResetMsg("");
    setResetError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-950 dark:to-gray-900">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-36 h-14 relative mx-auto mb-4">
            <Image src="/logo.webp" alt="National Group India" fill className="object-contain" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            National Group India
          </h1>
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
            AttendEase
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {view === "login" ? "Sign in to your account" : "Reset your password"}
          </p>
        </div>

        <Card>
          {/* ── Login Form ── */}
          {view === "login" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <Button type="submit" loading={loading} className="w-full" size="lg">
                Sign In
              </Button>

              <button
                type="button"
                onClick={() => { setError(""); setView("forgot-email"); }}
                className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Forgot password?
              </button>
            </form>
          )}

          {/* ── Forgot: Enter Email ── */}
          {view === "forgot-email" && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enter your registered email and we&apos;ll send you a 6-digit code to reset your password.
              </p>
              <Input
                label="Email"
                type="email"
                placeholder="you@company.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                autoComplete="email"
                required
              />

              {resetError && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2 rounded-lg">
                  {resetError}
                </div>
              )}

              <Button type="submit" loading={resetLoading} className="w-full" size="lg">
                Send Reset Code
              </Button>

              <button
                type="button"
                onClick={resetForgotState}
                className="w-full text-center text-sm text-gray-500 dark:text-gray-400 hover:underline"
              >
                Back to Sign In
              </button>
            </form>
          )}

          {/* ── Forgot: Enter Code + New Password ── */}
          {view === "forgot-code" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enter the 6-digit code sent to <strong>{resetEmail}</strong> and set your new password.
              </p>

              <Input
                label="Reset Code"
                type="text"
                placeholder="123456"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoComplete="one-time-code"
                required
              />
              <Input
                label="New Password"
                type="password"
                placeholder="Min 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <Input
                label="Confirm Password"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />

              {resetMsg && (
                <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm px-3 py-2 rounded-lg">
                  {resetMsg}
                </div>
              )}
              {resetError && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2 rounded-lg">
                  {resetError}
                </div>
              )}

              <Button type="submit" loading={resetLoading} className="w-full" size="lg">
                Reset Password
              </Button>

              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  onClick={() => { setResetError(""); setResetMsg(""); setView("forgot-email"); }}
                  className="text-gray-500 dark:text-gray-400 hover:underline"
                >
                  Change email
                </button>
                <button
                  type="button"
                  onClick={resetForgotState}
                  className="text-gray-500 dark:text-gray-400 hover:underline"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* ── Forgot: Success ── */}
          {view === "forgot-done" && (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Password Reset!</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your password has been changed successfully. You can now sign in with your new password.
              </p>
              <Button onClick={resetForgotState} className="w-full" size="lg">
                Sign In
              </Button>
            </div>
          )}
        </Card>

        {/* Register link */}
        {view === "login" && (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
            >
              Create account
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
