const defaultTitle = "Git Author Info";
const usernameInput = document.querySelector(".username-input");
const getButton = document.querySelector(".get-button");
const workingStatusText = document.querySelector(".working-status-text");
const resultText = document.querySelector(".result-text");

// GitHub usernames: alphanumeric and hyphens, no leading hyphen, max 39 chars, allow trailing hyphens.
// https://github.com/shinnn/github-username-regex/blob/0794566cc10e8c5a0e562823f8f8e99fa044e5f4/index.js#L1C16-L1C58
// https://github.com/shinnn/github-username-regex/pull/5
const validUsernameRegex = /^[a-z\d](?:[a-z\d]|-(?!-)){0,38}$/i;

let working;

const GITHUB_API = "https://api.github.com";

function sanitizeString(string) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };
  const reg = /[&<>"'/]/gi;
  return string.replace(reg, (match) => map[match]);
}

class HTTPError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "HTTPError";
    this.status = code;
  }
}

async function getUserInfo(username) {
  const response = await fetch(`${GITHUB_API}/users/${username}`);
  const data = await response.json();
  if (!response.ok) {
    console.error("HTTPError", response);
    throw new HTTPError(response.status, data.message || "Unknown error");
  }
  return data;
}

/**
 * Get the email address associated with the user's commits. We employ two strategies:
 * 1. Check the user's public events for commit data.
 * 2. Check the user's repositories for commits authored by them.
 * @param {string} username - The GitHub username.
 * @returns {Promise<string|null>} - The email address (a real one, not a noreply one), or null if not found.
 */
async function getCommitEmail(username) {
  try {
    const response = await fetch(
      `${GITHUB_API}/users/${username}/events/public`
    );
    if (response.ok) {
      const events = await response.json();
      for (const event of events) {
        if (event.type === "PushEvent" && event.payload.commits) {
          for (const commit of event.payload.commits) {
            if (commit.author && commit.author.email) {
              const email = commit.author.email;
              if (!email.includes("noreply.github.com")) {
                return email;
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Failed to fetch commit email from events:", err);
  }

  // Try non-forked repos first as they're more likely to have the user's own commits.
  // If no email is found, we will check the user's forked repos. We'll check up to ten
  // repos in total to avoid excessive API calls.
  try {
    const reposResponse = await fetch(
      `${GITHUB_API}/users/${username}/repos?sort=updated&per_page=30`
    );
    if (reposResponse.ok) {
      const repos = await reposResponse.json();
      const nonForkedRepos = repos.filter((repo) => !repo.fork);
      const reposToCheck = nonForkedRepos.length > 0 ? nonForkedRepos : repos;

      for (const repo of reposToCheck.slice(0, 10)) {
        try {
          const commitsResponse = await fetch(
            `${GITHUB_API}/repos/${repo.owner.login}/${repo.name}/commits?author=${username}&per_page=10`
          );

          if (!commitsResponse.ok) continue;

          const commits = await commitsResponse.json();

          for (const commitData of commits) {
            if (
              commitData.commit &&
              commitData.commit.author &&
              commitData.commit.author.email
            ) {
              const email = commitData.commit.author.email;
              if (!email.includes("noreply.github.com")) {
                return email;
              }
            }
          }
        } catch (err) {
          console.error(`Failed to fetch commits from ${repo.full_name}:`, err);
          continue;
        }
      }
    }
  } catch (err) {
    console.error("Failed to fetch repos:", err);
  }

  return null;
}

function checkInputValidity() {
  if (!validUsernameRegex.test(usernameInput.value)) {
    let msg;
    if (!usernameInput.value.length) {
      msg = "Please enter a GitHub username";
    } else {
      msg = "Invalid username";
    }
    usernameInput.setCustomValidity(msg);
    usernameInput.reportValidity();
    return false;
  }
  return true;
}

function setWorkingStatus() {
  working = true;
  let workingStep = 1;
  usernameInput.readOnly = true;
  getButton.disabled = true;
  function showWorkingDots() {
    if (working) {
      workingStatusText.textContent = `working${" .".repeat(workingStep)}`;
      if (workingStep === 3) {
        workingStep = 1;
      } else {
        workingStep++;
      }
      setTimeout(showWorkingDots, 150);
    }
  }
  showWorkingDots();
}

function setFinishedStatus(errored, details) {
  working = false;
  workingStatusText.textContent = errored ? "ERROR!!!" : "done!";
  if (errored) {
    workingStatusText.classList.add("error");
    resultText.classList.add("error");
  }
  resultText.innerHTML = details;
  usernameInput.readOnly = false;
  getButton.disabled = false;
}

function updateQueryParamsAndTitle(username) {
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  searchParams.set("username", username);
  window.history.replaceState(null, null, url);
  document.title = username.concat(" | ", defaultTitle);
}

function removeQueryParamsAndTitle() {
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  for (let key of Array.from(searchParams.keys())) {
    searchParams.delete(key);
  }
  window.history.replaceState(null, null, url);
  document.title = defaultTitle;
}

function resetOutputStatus() {
  workingStatusText.innerHTML = "";
  workingStatusText.classList.remove("error");
  resultText.innerHTML = "";
  resultText.classList.remove("error");
  removeQueryParamsAndTitle();
}

async function copyToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const originalText = button.textContent;
    button.textContent = "Copied!";
    button.classList.add("copied");
    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove("copied");
    }, 1500);
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
  }
}

function createResultHTML(userData, commitEmail) {
  const name = userData.name || userData.login;
  // Our priority is: commit email > API email > noreply GitHub standard email
  const email =
    commitEmail ||
    userData.email ||
    `${userData.id}+${userData.login}@users.noreply.github.com`;
  const isNoreply = !commitEmail && !userData.email;
  const isFromCommit = !!commitEmail && commitEmail !== userData.email;

  let html = `<div class="author-info">`;
  html += `<div class="author-info-line" data-copy="${sanitizeString(
    name
  )}"><strong>Name:</strong> ${sanitizeString(name)}</div>`;
  html += `<div class="author-info-line" data-copy="${sanitizeString(
    email
  )}"><strong>Email:</strong> ${sanitizeString(email)}</div>`;
  html += `</div>`;

  if (isNoreply) {
    html += `<p class="noreply-note">No public email address found from recent commits. Here's their GitHub noreply address.</p>`;
  } else if (isFromCommit) {
    html += `<p class="noreply-note">Email address found from recent commits.</p>`;
  }

  html += `<button class="copy-button" data-name="${sanitizeString(
    name
  )}" data-email="${sanitizeString(
    email
  )}">Copy as "Name &lt;email&gt;"</button>`;

  return html;
}

async function onSubmit() {
  if (!checkInputValidity()) {
    return;
  }
  const match = validUsernameRegex.exec(usernameInput.value);
  const username = match[1];
  resetOutputStatus();
  setWorkingStatus();
  let resultString;
  try {
    const [userData, commitEmail] = await Promise.all([
      getUserInfo(username),
      getCommitEmail(username),
    ]);
    resultString = createResultHTML(userData, commitEmail);
    setFinishedStatus(false, resultString);
    updateQueryParamsAndTitle(username);

    const copyButton = document.querySelector(".copy-button");
    if (copyButton) {
      copyButton.addEventListener("click", () => {
        const name = copyButton.dataset.name;
        const email = copyButton.dataset.email;
        copyToClipboard(`${name} <${email}>`, copyButton);
      });
    }

    document.querySelectorAll(".author-info-line").forEach((line) => {
      line.addEventListener("click", () => {
        const text = line.dataset.copy;
        navigator.clipboard.writeText(text).then(() => {
          const original = line.innerHTML;
          line.innerHTML += " <em>(copied!)</em>";
          setTimeout(() => {
            line.innerHTML = original;
          }, 1000);
        });
      });
    });
  } catch (err) {
    if (err.name === "HTTPError") {
      if (err.status === 404) {
        resultString =
          "That user does not exist. Please check the username and try again.";
      } else if (
        err.status === 403 &&
        err.message.toLowerCase().includes("api rate limit exceeded")
      ) {
        resultString =
          "API rate limit exceeded. Please wait and try again later.";
      } else {
        resultString = `unexpected error: ${sanitizeString(err.toString())}`;
      }
    } else {
      resultString = `unexpected error: ${sanitizeString(err.toString())}`;
    }
    setFinishedStatus(true, resultString);
  }
}

usernameInput.addEventListener("keydown", (event) => {
  usernameInput.setCustomValidity("");
  if (event.key === "Enter") {
    onSubmit();
  }
});
getButton.addEventListener("click", onSubmit);

function maybeUseUsernameFromURL() {
  const params = new URLSearchParams(document.location.search.substring(1));
  let username = params.get("username");
  if (username === null) {
    return;
  }
  usernameInput.blur();
  const tipAdmonition = document.querySelector("#tip-admonition");
  if (tipAdmonition) {
    tipAdmonition.remove();
  }
  usernameInput.value = username;
  getButton.click();
}

window.addEventListener("DOMContentLoaded", maybeUseUsernameFromURL);
