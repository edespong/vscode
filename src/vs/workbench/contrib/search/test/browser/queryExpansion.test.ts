/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { QueryExpansion } from 'vs/workbench/contrib/search/common/queryExpansion';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { TestEditorService } from 'vs/workbench/test/workbenchTestServices';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { EditorInput } from 'vs/workbench/common/editor';
import { URI } from 'vs/base/common/uri';
import { IEditorModel } from 'vs/platform/editor/common/editor';
import { Registry } from 'vs/platform/registry/common/platform';
import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { TestCommandService } from 'vs/editor/test/browser/editorTestServices';
import { expandSearchTokenCommand } from 'vs/workbench/browser/parts/editor/searchTokenExpansion';
import { ISearchTokenRegistry, SearchExtensions } from 'vs/workbench/services/search/common/searchTokenRegistry';

const DEFAULT_USER_CONFIG = {
	expandableTokens: {
		'@src': ['**/src'],
		'@all': ['@src', '*.foo']
	}
};

suite('QueryExpansion', () => {
	let instantiationService: TestInstantiationService;
	let queryExpansion: QueryExpansion;
	let mockConfigService: TestConfigurationService;
	setup(() => {
		instantiationService = new TestInstantiationService();

		const commandService = new TestCommandService(instantiationService);
		instantiationService.stub(ICommandService, commandService);

		mockConfigService = new TestConfigurationService();
		mockConfigService.setUserConfiguration('search', DEFAULT_USER_CONFIG);
		instantiationService.stub(IConfigurationService, mockConfigService);

		queryExpansion = instantiationService.createInstance(QueryExpansion, true);
	});

	suite('editor', () => {
		suiteSetup(() => {
			Registry.as<ISearchTokenRegistry>(SearchExtensions.SearchTokens).registerToken({
				token: '@editor',
				command: 'editor.expandSearchToken'
			});

			CommandsRegistry.registerCommand('editor.expandSearchToken', expandSearchTokenCommand);
		});

		setup(() => {
			const mockEditorService = new TestEditorService();
			mockEditorService.editors = [
				new TestEditorInput(URI.file('c:\\foobar\\foo.ts'), false),
				new TestEditorInput(URI.file('c:\\foobar\\bar.ts'), true),
			];
			instantiationService.stub(IEditorService, mockEditorService);
		});

		test('expands @editor(open) into open files', async () => {
			const expected = ['c:\\foobar\\foo.ts', 'c:\\foobar\\bar.ts'];
			const actual = await queryExpansion.expandQuerySegments(['@editor(open)']);
			assertEqualSegments(actual, expected);
		});
	});

	suite('configuration', () => {
		test('simple expansion into pattern', async () => {
			const actual = await queryExpansion.expandQuerySegments(['@src']);
			assertEqualSegments(actual, ['**/src']);
		});

		test('expansion into pattern from reference to other config token', async () => {
			const actual = await queryExpansion.expandQuerySegments(['@all']);
			assertEqualSegments(actual, ['**/src', '*.foo']);
		});
	});
});

class TestEditorInput extends EditorInput {
	constructor(private readonly resource: URI,
		private readonly unsaved: boolean
	) {
		super();
	}

	getResource(): URI { return this.resource; }

	isDirty(): boolean { return this.unsaved; }

	getTypeId() { return 'testQueryExpansion'; }

	resolve(): Promise<IEditorModel> { return Promise.resolve(null!); }
}

function assertEqualSegments(actual: string[], expected: string[]) {
	const actualNormalized = actual.map(normalizePath);
	const expectedNormalized = expected.map(normalizePath);
	assert.deepStrictEqual(actualNormalized, expectedNormalized);
}

function normalizePath(path: string) {
	return path.replace(/\\/g, '/');
}
