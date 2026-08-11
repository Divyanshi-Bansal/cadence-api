import { decrypt, decryptDeterministic } from "./crypto";

export interface CleanUser {
  id: string;
  email: string;
  name: string | null;
  authProvider?: string;
  isEmailVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

function safeDecrypt(val: string): string {
  if (!val) return "";
  try {
    return decrypt(val);
  } catch {
    try {
      return decryptDeterministic(val);
    } catch {
      return val;
    }
  }
}

export function formatUser(user: {
  id: string;
  emailEncrypted: string;
  nameEncrypted?: string | null;
  authProvider?: string;
  isEmailVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}): CleanUser {
  const email = safeDecrypt(user.emailEncrypted);
  const name = user.nameEncrypted ? safeDecrypt(user.nameEncrypted) : null;

  return {
    id: user.id,
    email,
    name,
    authProvider: user.authProvider,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
