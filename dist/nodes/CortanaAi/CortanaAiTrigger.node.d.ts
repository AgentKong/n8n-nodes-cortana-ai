import type { IHookFunctions, IWebhookFunctions, INodeType, INodeTypeDescription, IWebhookResponseData, ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
export declare class CortanaAiTrigger implements INodeType {
    description: INodeTypeDescription;
    methods: {
        loadOptions: {
            getBusinesses(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
            getConversionConfigs(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
        };
    };
    webhookMethods: {
        default: {
            checkExists(this: IHookFunctions): Promise<boolean>;
            create(this: IHookFunctions): Promise<boolean>;
            delete(this: IHookFunctions): Promise<boolean>;
        };
    };
    webhook(this: IWebhookFunctions): Promise<IWebhookResponseData>;
}
//# sourceMappingURL=CortanaAiTrigger.node.d.ts.map