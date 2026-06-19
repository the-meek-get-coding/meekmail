import { UserManager, type User } from "oidc-client-ts";
import { config } from "./config";

let userManager: UserManager | undefined;

export function getUserManager(): UserManager {
  if (!userManager) {
    userManager = new UserManager({
      authority: config.cognitoAuthority,
      client_id: config.cognitoClientId,
      redirect_uri: config.cognitoRedirectUri,
      post_logout_redirect_uri: `${window.location.origin}/admin`,
      response_type: "code",
      scope: "openid email profile"
    });
  }

  return userManager;
}

export async function getUser(): Promise<User | null> {
  if (config.devAdmin) {
    return {
      id_token: "dev-admin",
      access_token: "dev-admin",
      expired: false,
      profile: {
        sub: "dev-admin"
      }
    } as User;
  }

  if (!config.cognitoAuthority || !config.cognitoClientId) {
    return null;
  }
  return getUserManager().getUser();
}

export async function login(): Promise<void> {
  if (config.devAdmin) {
    window.location.assign("/admin");
    return;
  }

  await getUserManager().signinRedirect();
}

export async function handleLoginCallback(): Promise<void> {
  if (config.devAdmin) {
    return;
  }

  await getUserManager().signinRedirectCallback();
}

export async function logout(): Promise<void> {
  if (config.devAdmin) {
    window.location.assign("/admin");
    return;
  }

  await getUserManager().signoutRedirect();
}
