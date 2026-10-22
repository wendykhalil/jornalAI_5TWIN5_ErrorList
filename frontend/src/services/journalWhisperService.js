
import authService from "./authService";

const configuredBase = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000/api"
).replace(/\/$/, "");

const API_ROOT = configuredBase.endsWith("/api")
  ? configuredBase
  : `${configuredBase}/api`;

/**
 * Send recorded audio to Django Whisper API.
 */
async function sendAudio(file, retry = true) {
  const { accessToken } = authService.getTokens();

  if (!accessToken) {
    throw new Error(
      "Session introuvable. Reconnectez-vous."
    );
  }

  const data = new FormData();

  data.append(
    "audio",
    file,
    file.name || "recording.webm"
  );

  const response = await fetch(
    `${API_ROOT}/journal/transcribe/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: data,
    }
  );

  // Refresh expired JWT token and retry once.
  if (response.status === 401 && retry) {
    const refreshed =
      await authService.refreshAccessToken();

    if (refreshed) {
      return sendAudio(file, false);
    }

    throw new Error(
      "Session expirée. Reconnectez-vous."
    );
  }

  const payload = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload.error ||
      payload.detail ||
      `Erreur HTTP ${response.status}`
    );
  }

  return payload;
}

/**
 * Whisper transcription service.
 */
export const journalWhisperService = {
  transcribe: sendAudio,
};

export default journalWhisperService;
