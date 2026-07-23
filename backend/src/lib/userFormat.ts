import { decrypt } from "./crypto";

export interface CleanUser {
  id: string;
  email: string;
  name: string | null;
  authProvider?: string;
  isEmailVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
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
  let email = "";
  try {
    email = decrypt(user.emailEncrypted);
  } catch (err) {
    email = user.emailEncrypted;
  }

  let name: string | null = null;
  if (user.nameEncrypted) {
    try {
      name = decrypt(user.nameEncrypted);
    } catch (err) {
      name = user.nameEncrypted;
    }
  }

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
