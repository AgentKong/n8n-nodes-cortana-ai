import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription, ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
export declare class CortanaAi implements INodeType {
    description: INodeTypeDescription;
    methods: {
        loadOptions: {
            getConversionTypes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
        };
    };
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
//# sourceMappingURL=CortanaAi.node.d.ts.map