const defaultTitle = "Next PR Number";
const repoInput = document.querySelector(".repo-input");
const getButton = document.querySelector(".get-button");
const workingStatusText = document.querySelector(".working-status-text");
const resultText = document.querySelector(".result-text");
const validRepoRegex = /^\s*([-\w]+)\s*\/\s*([-.\w]+)\s*$|^https:\/\/github\.com\/([-\w]+)\/([-.\w]+)(?:\/.*)?$/
let working;

const API_ENDPOINT = "https://internal.floralily.dev/next-pr-number-api";

function sanitizeString(string) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    "/": '&#x2F;',
  };
  const reg = /[&<>"'/]/ig;
  return string.replace(reg, (match) => (map[match]));
}

class HTTPError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "HTTPError";
    this.status = code;
  }
}

async function getNextNumber(owner, name) {
  const response = await fetch(`${API_ENDPOINT}/?owner=${owner}&name=${name}`);
  const data = await response.json();
  if (!response.ok) {
    console.error("HTTPError", response);
    throw new HTTPError(response.status, data.detail);
  }
  plausible("Next PR Number: Fetch", {props: {repository: `${owner}/${name}`}});
  return data;
}

function checkInputValidity() {
  if (!validRepoRegex.test(repoInput.value)) {
    let msg;
    if (!repoInput.value.length) {
      msg = "Please enter a repo. e.g. github/docs";
    } else {
      msg = "Please match the {owner}/{name} format. e.g. github/docs"
    }
    repoInput.setCustomValidity(msg);
    repoInput.reportValidity();
    return false;
  }
  return true;
}

function setWorkingStatus() {
  working = true;
  let workingStep = 1;
  repoInput.readOnly = true;
  getButton.disabled = true;
  function showWorkingDots() {
    if (working) {
      workingStatusText.textContent = `working${" .".repeat(workingStep)}`
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
  repoInput.readOnly = false;
  getButton.disabled = false;
}

function updateQueryParamsAndTitle(owner, name) {
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  searchParams.set("owner", owner);
  searchParams.set("name", name);
  window.history.replaceState(null, null, url);
  document.title = owner.concat("/", name, " | ", defaultTitle);
}

function removeQueryParamsAndTitle() {
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  for (let key of Array.from(searchParams.keys())) {
    searchParams.delete(key)
  }
  window.history.replaceState(null, null, url)
  document.title = defaultTitle;
}

function resetOutputStatus() {
  workingStatusText.innerHTML = "";
  workingStatusText.classList.remove("error");
  resultText.innerHTML = "";
  resultText.classList.remove("error");
  removeQueryParamsAndTitle();
}

async function onSubmit() {
  if (!checkInputValidity()) {
    return;
  }
  const match = validRepoRegex.exec(repoInput.value);
  const [owner, name] = match[1] ? match.slice(1, 3) : match.slice(3, 5);
  resetOutputStatus();
  setWorkingStatus();
  let resultString;
  try {
    const nextNumber = await getNextNumber(owner, name);
    resultString = `${nextNumber.toString().bold()} will be the next number assigned.`
    setFinishedStatus(false, resultString);
    updateQueryParamsAndTitle(owner, name);
  }
  catch (err) {
    if (err.name === "HTTPError") {
      if (err.status === 404) {
        resultString = "That repository doesn't exist.";
      } else if (err.status === 403 && err.message.toLowerCase().includes("api rate limit exceeded")) {
        resultString = "API rate limit exceeded. Please wait and try again later."
      } else {
        resultString = `unexpected error: ${sanitizeString(err.toString())}`;
      }
    } else {
      resultString = `unexpected error: ${sanitizeString(err.toString())}`;
    }
    setFinishedStatus(true, resultString);
  }
}

repoInput.addEventListener("keydown", (event) => {
  repoInput.setCustomValidity("");
  if (event.key === "Enter") {
    onSubmit();
  }
});
getButton.addEventListener("click", onSubmit);

function maybeUseRepoFromURL() {
  const params = new URLSearchParams(document.location.search.substring(1));
  let owner = params.get("owner"), name = params.get("name");
  if (owner === null || name === null) {
    return;
  }
  repoInput.blur();
  document.querySelector("#tip-admonition").remove();
  repoInput.value = `${owner}/${name}`;
  getButton.click();
}

window.addEventListener("DOMContentLoaded", maybeUseRepoFromURL);
