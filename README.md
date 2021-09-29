# Next PR Number

Next PR Number is a web tool that allows you to quickly and easily know what number
your PR will be assigned before opening it. Forget guessing the number or checking
afterhand.

**Features:**

- **Client-side only** - There's is no backend service powering Next PR Number. Hosting
  your own version only requires a static web server.
- **Sharable URLs that autofill the repository** - Want your project's contributors to
  use Next PR Number? Give them a link that autofills and queries your repository for
  them for a seamless experience.
- **Lightweight** - Next PR Number is built with pure HTML, JS, CSS. There's no
  dependencies that slow down page load.

In all seriousness, this was created to make changelog entry enforcement easier
and a smoother experience for everyone. I help maintain [Black](https://github.com/psf/black)
and I provide documentation assistance for [bandersnatch](https://github.com/pypa/bandersnatch)
. Updating a changelog in preparation for a release takes time, valuable time away
from other things. So a policy was introduced where PRs now must have an changelog
entry which contains the PR number. While that reduced the administrative workload,
it pretty much pushed the workload on to the contributors, who must now get the PR
number somehow. You can guess / fill-in the rest of the details :)

**Note: Next PR Number only supports public GitHub repositories**

## Contributing

Contributions of all sorts are welcomed, even feedback if it's constructive! Opening
an issue to check with me before working on a changeset is highly recommended.

In terms of technical tips, I recommend that you use Python's built-in webserver to test
locally while iterating on your changes:

```console
example-user@example-desktop:~$ cd next-pr-number
example-user@example-desktop:~/next-pr-number$ python -m http.server 4000
Serving HTTP on 0.0.0.0 port 4000 (http://0.0.0.0:4000/) ...
```

Please note that this project to also my excuse to learn web development. So I'm sure
I'm doing a ton of things wrong in this project :) I'm open to feedback in this regard
too.

Finally, don't forget to add yourself to the AUTHORS list below. You made a contribution
and you deserve the thanks!

## Authors

Glued together by Richard Si ([@ichard26](https://github.com/ichard26)).

- *your name here perhaps?*
