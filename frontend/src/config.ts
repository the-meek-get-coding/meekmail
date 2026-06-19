export const config = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, ""),
  cognitoAuthority: import.meta.env.VITE_COGNITO_AUTHORITY || "",
  cognitoClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || "",
  cognitoRedirectUri: import.meta.env.VITE_COGNITO_REDIRECT_URI || `${window.location.origin}/admin/callback`,
  devAdmin: import.meta.env.VITE_DEV_ADMIN === "true"
};
