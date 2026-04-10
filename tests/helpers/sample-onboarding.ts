import { onboardProjectContext } from '../../core/context/onboarding.js';

export async function seedSampleOnboarding(rootDir: string): Promise<void> {
  await onboardProjectContext({
    rootDir,
    primaryRoleSummary: 'I mainly maintain auth and payment APIs.',
    workTypes: [
      {
        name: 'API development',
        summary: 'Update service boundaries, DTOs, and tests together.',
        repositories: [
          {
            repository: 'sample-repo',
            repositoryPath: rootDir,
            purpose: 'Fixture repository for Shift AX tests.',
            directories: ['src', 'tests'],
            workflow: 'Update code and tests together, then verify with npm test and npm run build.',
          },
        ],
      },
    ],
    domainLanguage: [
      {
        term: 'Auth policy',
        definition: 'Fixture auth policy term for test onboarding.',
      },
    ],
  });
}
