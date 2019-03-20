/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';

import * as Objects from 'vs/base/common/objects';

import { TaskIdentifier, KeyedTaskIdentifier, TaskDefinition } from 'vs/workbench/contrib/tasks/common/tasks';
import { TaskDefinitionRegistry } from 'vs/workbench/contrib/tasks/common/taskDefinitionRegistry';

namespace KeyedTaskIdentifier {
	function hexValue(input: string): string {
		let result: number = 0;
		for (let i = 0; i < input.length; i++) {
			result += input.charCodeAt(i);
		}
		return '' + result;
	}

	function sortedStringify(literal: any): string {
		const keys = Object.keys(literal).sort();
		let result: string = '';
		for (let position in keys) {
			let test = literal[keys[position]];
			if (test instanceof Object) {
				test = sortedStringify(test);
			}
			let stringified: string = '' + test;
			if (stringified.length > 100) { // 100 is an arbitrary number
				// This can result in collisions. Divide the string in half, since this value will start to converge at long lengths. This not ideal.
				stringified = hexValue(stringified.substring(0, stringified.length / 2)) + hexValue(stringified.substring(stringified.length / 2, stringified.length));
			}

			result += keys[position] + ',' + stringified + ',';
		}
		return result;
	}
	export function create(value: TaskIdentifier): KeyedTaskIdentifier {
		const resultKey = sortedStringify(value);
		return { _key: resultKey, type: value.taskType };
	}
}

namespace TaskDefinition {
	export function createTaskIdentifier(external: TaskIdentifier, reporter: { error(message: string): void; }): KeyedTaskIdentifier | undefined {
		let definition = TaskDefinitionRegistry.get(external.type);
		if (definition === undefined) {
			// We have no task definition so we can't sanitize the literal. Take it as is
			let copy = Objects.deepClone(external);
			delete copy._key;
			return KeyedTaskIdentifier.create(copy);
		}

		let literal: { type: string;[name: string]: any } = Object.create(null);
		literal.type = definition.taskType;
		let required: Set<string> = new Set();
		definition.required.forEach(element => required.add(element));

		let properties = definition.properties;
		for (let property of Object.keys(properties)) {
			let value = external[property];
			if (value !== undefined && value !== null) {
				literal[property] = value;
			} else if (required.has(property)) {
				let schema = properties[property];
				if (schema.default !== undefined) {
					literal[property] = Objects.deepClone(schema.default);
				} else {
					switch (schema.type) {
						case 'boolean':
							literal[property] = false;
							break;
						case 'number':
						case 'integer':
							literal[property] = 0;
							break;
						case 'string':
							literal[property] = '';
							break;
						default:
							reporter.error(nls.localize(
								'TaskDefinition.missingRequiredProperty',
								'Error: the task identifier \'{0}\' is missing the required property \'{1}\'. The task identifier will be ignored.', JSON.stringify(external, undefined, 0), property
							));
							return undefined;
					}
				}
			}
		}
		return KeyedTaskIdentifier.create(literal);
	}
}

export { KeyedTaskIdentifier, TaskDefinition };
