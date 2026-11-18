# Third-Party Information

Banzai's [Apache-2.0 license](LICENSE) does not replace licenses for third-party
software or other material. Preserve the relevant licenses and notices when
redistributing those components.

## Dependencies

Banzai has none. The hook is plain JavaScript that uses only modules built
into Node.js, the tests use the Node.js test runner, and the repository has no
build step and no lock file. The plugin directory holds no third-party code.

If a dependency or bundled third-party material is added later, its license
text and notices must accompany that distribution, and this document must
name it.

## External tools and services

Git, Node.js, and Claude Code are separate tools with their own licenses or
terms. Banzai calls Git and runs on Node.js inside Claude Code; it does not
include them. Naming or integrating with them does not relicense them, grant a
subscription, or imply endorsement by their authors or providers.
