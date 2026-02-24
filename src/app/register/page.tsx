"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, Card } from "@/components/ui";

type Step = "email" | "verify" | "details";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // ─── Step 1: Send verification code ───────────────
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || "Failed to send code");
        return;
      }

      setStep("verify");
      setResendTimer(60);
      setCode(["", "", "", "", "", ""]);
      // Focus first code input after render
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ─── Handle code input ────────────────────────────
  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only digits

    const newCode = [...code];
    newCode[index] = value.slice(-1); // One char only
    setCode(newCode);

    // Auto-advance to next input
    if (value && index < 5) {
      codeRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5 && newCode.every((c) => c !== "")) {
      // Will be handled by the verify button
    }
  };

  const handleCodeKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split("");
      setCode(newCode);
      codeRefs.current[5]?.focus();
    }
  };

  // ─── Step 2: Verify code → go to details ──────────
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }
    setError("");
    setStep("details");
  };

  // ─── Step 3: Register ─────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          password,
          phone: phone.trim(),
          code: code.join(""),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || "Registration failed");
        return;
      }

      setSuccess("Account created successfully! Redirecting to login...");
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ─── Resend code ──────────────────────────────────
  const handleResend = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to resend");
        return;
      }
      setResendTimer(60);
      setCode(["", "", "", "", "", ""]);
      codeRefs.current[0]?.focus();
    } catch {
      setError("Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-950 dark:to-gray-900">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-36 h-14 relative mx-auto mb-4">
            <Image
              src="/logo.webp"
              alt="National Group India"
              fill
              className="object-contain"
            />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Create Account
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {step === "email" && "Enter your email to get started"}
            {step === "verify" && "Enter the code sent to your email"}
            {step === "details" && "Complete your profile"}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {(["email", "verify", "details"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === s
                    ? "bg-blue-600 text-white"
                    : i <
                        ["email", "verify", "details"].indexOf(step)
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                }`}
              >
                {i <
                ["email", "verify", "details"].indexOf(step) ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {i < 2 && (
                <div
                  className={`w-8 h-0.5 ${
                    i < ["email", "verify", "details"].indexOf(step)
                      ? "bg-green-500"
                      : "bg-gray-200 dark:bg-gray-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <Card>
          {success ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-green-600 dark:text-green-400 font-medium">
                {success}
              </p>
            </div>
          ) : (
            <>
              {/* Step 1: Email */}
              {step === "email" && (
                <form onSubmit={handleSendCode} className="space-y-4">
                  <Input
                    label="Email address"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    autoFocus
                    required
                  />

                  {error && <ErrorMsg message={error} />}

                  <Button
                    type="submit"
                    loading={loading}
                    className="w-full"
                    size="lg"
                  >
                    Send Verification Code
                  </Button>
                </form>
              )}

              {/* Step 2: Verify Code */}
              {step === "verify" && (
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div className="text-center mb-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Code sent to{" "}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {email}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setStep("email");
                        setError("");
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                    >
                      Change email
                    </button>
                  </div>

                  {/* 6-digit code inputs */}
                  <div
                    className="flex justify-center gap-2"
                    onPaste={handleCodePaste}
                  >
                    {code.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { codeRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleCodeChange(i, e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(i, e)}
                        className="w-11 h-13 text-center text-xl font-bold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
                        autoFocus={i === 0}
                      />
                    ))}
                  </div>

                  {error && <ErrorMsg message={error} />}

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={code.join("").length !== 6}
                  >
                    Verify Code
                  </Button>

                  <div className="text-center">
                    {resendTimer > 0 ? (
                      <p className="text-xs text-gray-400">
                        Resend code in {resendTimer}s
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={loading}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Resend code
                      </button>
                    )}
                  </div>
                </form>
              )}

              {/* Step 3: Details */}
              {step === "details" && (
                <form onSubmit={handleRegister} className="space-y-4">
                  <Input
                    label="Full Name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    autoFocus
                    required
                  />
                  <Input
                    label="Phone (optional)"
                    type="tel"
                    placeholder="+91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                  />
                  <Input
                    label="Password"
                    type="password"
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

                  {error && <ErrorMsg message={error} />}

                  <Button
                    type="submit"
                    loading={loading}
                    className="w-full"
                    size="lg"
                  >
                    Create Account
                  </Button>
                </form>
              )}
            </>
          )}
        </Card>

        {/* Back to login */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function ErrorMsg({ message }: { message: string }) {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2 rounded-lg">
      {message}
    </div>
  );
}
