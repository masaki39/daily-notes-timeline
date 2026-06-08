# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed
- Normalize CRLF line endings to LF when reading note content, so heading filter and other filters work correctly on files edited by Windows or apps that use CRLF.

## [0.0.7] - 2026-05-22

### Fixed
- Add eslint as an explicit dependency.
- Update release process to use pnpm.

## [0.0.6] - 2026-05-21

### Changed
- Migrate package manager from npm to pnpm.
- Add release notes and attestation workflow.

## [0.0.5] - 2026-05-21

### Changed
- Rename app ID for clarity.

## [0.0.4] - 2026-03-19

### Added
- Header collapse setting: allow collapsing the timeline header via settings.

## [0.0.3] - 2026-03-17

### Added
- Toggle button to collapse/expand the timeline header from the UI.

## [0.0.2] - 2026-01-04

### Added
- Support folder-based daily note formats (e.g. `YYYY/MM/DD`).
- Support Markdown image URLs as image content.

### Fixed
- Strict null check errors.
- Lint configuration.

## [0.0.1] - 2026-01-03

### Added
- Initial release: timeline view for daily notes.
- Timeline filter modes: all, tasks, lists, links, images, callouts, heading.
- Search within timeline.
- Task toggle (check/uncheck) directly in the timeline.
- CI test workflow.
