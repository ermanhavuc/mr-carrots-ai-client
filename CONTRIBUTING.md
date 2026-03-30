# Contributing to Mr. Carrot's AI Client

Thank you for considering contributing to Mr. Carrot's AI Client. Here are the project guidelines.

## Contribution Terms

This fork does not require a separate Contributor License Agreement. By submitting a contribution, you agree that it can be distributed under the project's AGPL-3.0-or-later license.

## Code Contributions

### Development Environment

- **Node.js version**: `22.20.0`
- **npm version**: `11.6.0`

Use [nvm](https://github.com/nvm-sh/nvm) to switch between Node.js versions.

### Guidelines

1. **Keep `package-lock.json`**: `electron` and `electron-forge` are picky things and the versions of the packages used are important.
2. **Installing dependencies**: Run `npm ci` to ensure you install the exact versions listed in `package-lock.json`
3. **Linting**: Run `npm run lint` to check for and fix any linting issues.
4. **Testing**: Add/Update required tests. Coverage varies betwen 80% and 82% and I would like to keep it that way (or more!). Run `npm run test` to ensure all tests pass before submitting your changes.

### API Keys Safe Storage

Beware that when API Keys Safe Storage is activated, your DEBUG build and RELEASE build will store API keys in distinct locations as one variant cannot read API keys written by the other variant. To handle that you have two options:

- Accept to enter your API keys twice (for each variant)
- Disable API keys Safe Storage in Settings | Advanced  

## Translation Contributions

### Steps

1. **Generate Translation File**: Use the script `./tools/i18n_auto.ts` with the two-letter language code (e.g., "es") and the name of the language in English (e.g., "Spanish").
2. **Review Translation**: Copy the generated file to a `locales` subfolder of the  data folder. You need to create this folder in:
  - **Windows**: `%APPDATA%/Mr Carrots AI Client`
  - **macOS**: `~/Library/Application\ Support/Mr Carrots AI Client`
  - **Linux**: `~/.config/Mr Carrots AI Client`
3. **Reload the App**: Reload the application to review the translation.
4. **Select your language**: You should see your language in Settings | General. If you do not see the proper flag and name for your language you can add it to `src/components/LangSelect.vue`
5. **Final Review**: Before committing you can run `./tools/i18n_check.ts` whcih should return no errors and finally `./tools/i18n_sort.ts` to clean your file!
6. **Create a Pull Request**: Once you are satisfied with the translation, create a pull request for review.

Thank you for your contributions.