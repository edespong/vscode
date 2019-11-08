/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as arrays from 'vs/base/common/arrays';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { toResource, IEditorInput } from 'vs/workbench/common/editor';

/**
 * Expand a registered search token into relevant file paths.
 */
export function expandSearchTokenCommand(accessor: ServicesAccessor, ...properties: string[]): Promise<string[] | undefined> {
	// 'current' |'open' | 'unsaved'
	const editorService = accessor.get(IEditorService);
	return Promise.resolve(expand(properties, editorService));
}

function expand(properties: string[], editorService: IEditorService): string[] {
	const paths = getEditors(properties, editorService)
		.map(editor => toResource(editor))
		.filter(uri => !!uri && uri.scheme === 'file')
		.map(uri => uri!.fsPath);
	return Array.from(new Set(paths));
}

function getEditors(properties: string[], editorService: IEditorService): ReadonlyArray<IEditorInput> {
	const result = properties.map(property => {
		if (property === 'current') {
			if (editorService.activeEditor !== undefined) {
				return [editorService.activeEditor];
			} else {
				return undefined;
			}
		}

		if (property === 'open') {
			return Array.from(editorService.editors);
		}

		if (property === 'unsaved') {
			return editorService.editors.filter(e => e.isDirty());
		}

		throw new Error(`@editor - Invalid parameter: ${property}`);
	});

	function isDefined(e: IEditorInput[] | undefined): e is IEditorInput[] {
		return !!e;
	}

	return arrays.flatten(result.filter(isDefined));
}
