// Google Drive sync utilities (placeholder OAuth client ID in manifest)

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';
const ROOT_FOLDER_ID = 'root';
const STOCKPILE_FOLDER_NAME = 'Stockpile';
const SYNC_FILE_NAME = 'stockpile-sync.json';

async function getAuthToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!token) {
        reject(new Error('No OAuth token'));
        return;
      }
      resolve(token);
    });
  });
}

async function getWebClientId() {
  const result = await chrome.storage.local.get('settings');
  return result.settings?.pro?.driveWebClientId || '';
}

function buildOAuthUrl(clientId, redirectUri, scope) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope,
    include_granted_scopes: 'true',
    prompt: 'consent'
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function getAuthTokenViaWebFlow(scope) {
  const clientId = await getWebClientId();
  if (!clientId) {
    throw new Error('missing_web_client_id');
  }

  const redirectUri = chrome.identity.getRedirectURL('oauth2');
  const authUrl = buildOAuthUrl(clientId, redirectUri, scope);

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      (responseUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!responseUrl) {
          reject(new Error('No response URL from web auth flow'));
          return;
        }
        const hash = responseUrl.split('#')[1] || '';
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        if (!accessToken) {
          reject(new Error('No access token in response'));
          return;
        }
        resolve(accessToken);
      }
    );
  });
}

async function apiRequest(path, token, options = {}) {
  const response = await fetch(`${DRIVE_API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Drive API error ${response.status}: ${text}`);
  }

  return response.json();
}

async function uploadRequest(path, token, body, contentType) {
  const response = await fetch(`${UPLOAD_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType
    },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Drive Upload error ${response.status}: ${text}`);
  }

  return response.json();
}

async function ensureStockpileFolder(token) {
  const query = encodeURIComponent(
    `name='${STOCKPILE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${ROOT_FOLDER_ID}' in parents`
  );

  const list = await apiRequest(`/files?q=${query}&fields=files(id,name)`, token);
  if (list.files && list.files.length > 0) {
    return list.files[0].id;
  }

  const metadata = {
    name: STOCKPILE_FOLDER_NAME,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [ROOT_FOLDER_ID]
  };

  const created = await apiRequest('/files?fields=id,name', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata)
  });

  return created.id;
}

async function findSyncFile(token, folderId) {
  const query = encodeURIComponent(
    `name='${SYNC_FILE_NAME}' and trashed=false and '${folderId}' in parents`
  );
  const list = await apiRequest(`/files?q=${query}&fields=files(id,name)`, token);
  return list.files && list.files.length > 0 ? list.files[0] : null;
}

async function uploadJsonToDrive(token, folderId, jsonString) {
  const existing = await findSyncFile(token, folderId);
  const metadata = {
    name: SYNC_FILE_NAME,
    mimeType: 'application/json'
  };

  const boundary = 'stockpileBoundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  const multipartBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    jsonString +
    closeDelimiter;

  if (existing) {
    const updateResponse = await fetch(
      `${UPLOAD_API_BASE}/files/${existing.id}?uploadType=multipart`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      }
    );

    if (!updateResponse.ok) {
      const text = await updateResponse.text();
      throw new Error(`Drive update error ${updateResponse.status}: ${text}`);
    }

    return updateResponse.json();
  }

  metadata.parents = [folderId];

  return uploadRequest('/files?uploadType=multipart', token, multipartBody, `multipart/related; boundary=${boundary}`);
}

export async function syncToDrive(payload, options = {}) {
  let token;
  const webClientId = await getWebClientId();
  const scope = 'https://www.googleapis.com/auth/drive.file';

  if (webClientId) {
    token = await getAuthTokenViaWebFlow(scope);
  } else {
    try {
      token = await getAuthToken(!!options.interactive);
    } catch (error) {
      const message = error?.message || '';
      if (message.includes('Custom URI scheme is not supported')) {
        token = await getAuthTokenViaWebFlow(scope);
      } else {
        throw error;
      }
    }
  }
  const folderId = await ensureStockpileFolder(token);
  const jsonString = JSON.stringify(payload, null, 2);
  return uploadJsonToDrive(token, folderId, jsonString);
}
