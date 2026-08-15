import { createPublicKey, verify } from "node:crypto";

const RELEASE_SCHEMA = "linkora-release-v1";
const RELEASE_PUBLIC_KEY = createPublicKey({
  key: Buffer.from("MCowBQYDK2VwAyEAZUdFzXaxj3pJIQLPyxKhLVMBeoa7cAZlDIin+O2Yaxc=", "base64"),
  format: "der",
  type: "spki",
});

export type ReleaseRejectReason =
  | "MISSING_RELEASE_TICKET"
  | "MALFORMED_RELEASE_TICKET"
  | "INVALID_RELEASE_TICKET"
  | "OUTDATED_BUILD";

type ReleaseAccessResult =
  | { allowed: true; build: number }
  | { allowed: false; reason: ReleaseRejectReason };

function configuredMinimumBuild(): number {
  const value = Number.parseInt(process.env.MIN_SUPPORTED_BUILD ?? "3", 10);
  return Number.isSafeInteger(value) && value > 0 ? value : 3;
}

function isTicketRequired(): boolean {
  return process.env.REQUIRE_RELEASE_TICKET?.toLowerCase() !== "false";
}

function payloadFor(build: number, version: string): string {
  return `${RELEASE_SCHEMA}|${build}|${version}`;
}

/**
 * The release ticket proves that the client knows a signature generated outside
 * the repository. It is a release-access control, not device attestation.
 */
export function validateReleaseAccess(value: unknown): ReleaseAccessResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return isTicketRequired()
      ? { allowed: false, reason: "MISSING_RELEASE_TICKET" }
      : { allowed: true, build: 0 };
  }

  const release = value as Record<string, unknown>;
  const build = release["build"];
  const version = release["version"];
  const ticket = release["ticket"];

  if (
    typeof build !== "number" ||
    !Number.isSafeInteger(build) ||
    build < 1 ||
    typeof version !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(version) ||
    typeof ticket !== "string" ||
    ticket.length < 80 ||
    ticket.length > 200
  ) {
    return { allowed: false, reason: "MALFORMED_RELEASE_TICKET" };
  }

  let signature: Buffer;
  try {
    signature = Buffer.from(ticket, "base64url");
  } catch {
    return { allowed: false, reason: "MALFORMED_RELEASE_TICKET" };
  }

  if (!verify(null, Buffer.from(payloadFor(build, version), "utf8"), RELEASE_PUBLIC_KEY, signature)) {
    return { allowed: false, reason: "INVALID_RELEASE_TICKET" };
  }

  if (build < configuredMinimumBuild()) {
    return { allowed: false, reason: "OUTDATED_BUILD" };
  }

  return { allowed: true, build };
}
