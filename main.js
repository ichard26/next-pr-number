import { Octokit } from "https://cdn.skypack.dev/@octokit/core";

const octokit = new Octokit();
const repoInput = document.querySelector(".repo-input");
const getButton = document.querySelector(".get-button");
const workingStatusText = document.querySelector(".working-status-text");
const resultText = document.querySelector(".result-text");
const validRepoRegex = /^\s*([-\w]+)\/([-.\w]+)\s*$/
let working;

async function get_next_number(owner, repo) {
  let res = await octokit.request({
    method: "GET",
    url: "/repos/{owner}/{repo}/issues?state=all&direction=desc&sort=created&per_page=1",
    headers: {
      accept: "application/vnd.github.v3+json"
    },
    owner: owner,
    repo: repo,
  });
  return res.data.pop().number + 1;
}

function checkInputValidity() {
  const inputValue = repoInput.value;
  if (!validRepoRegex.test(inputValue)) {
    if (!repoInput.value.length) {
      repoInput.setCustomValidity(
        "Please enter a repo. e.g. github/docs"
      );
    } else {
      repoInput.setCustomValidity(
        "Please match the {owner}/{repo} format. e.g. github/docs"
      );
    }
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
      workingStatusText.textContent = `working ${". ".repeat(workingStep)}`
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

function setFinishedStatus(errored) {
  working = false;
  if (errored) {
    workingStatusText.textContent = "ERROR!!!";
    workingStatusText.setAttribute("class", workingStatusText.getAttribute("class") + " errored");
  } else {
    workingStatusText.textContent = "done!";
    workingStatusText.setAttribute("class", workingStatusText.getAttribute("class").replaceAll(" errored", ""));
  }
  repoInput.readOnly = false;
  getButton.disabled = false;
}

async function onSubmit() {
  if (!checkInputValidity()){
    return;
  }
  let owner, repo
  const match = validRepoRegex.exec(repoInput.value);
  [owner, repo] = match.slice(1);
  setWorkingStatus();
  let failed = false;
  let err = null;
  let nextNumber;
  // TODO: improve error handling
  // TODO: add colouring to output text according to if there was an error
  try {
    nextNumber = await get_next_number(owner, repo);
  }
  catch (e) {
    failed = true;
    err = e;
    console.table(err);
  }
  setFinishedStatus(failed);
  if (failed) {
    resultText.textContent = err.toString();
  } else {
    resultText.innerHTML = `${nextNumber.toString().bold()} will be the next number assigned.`;
  }
  
}

repoInput.addEventListener("keydown", (event) => {
  repoInput.setCustomValidity("");
  if (event.key === "Enter") {
    onSubmit();
  }
});
getButton.addEventListener("click", onSubmit);
