import { Type } from '@vendure/common/lib/shared-types';
import { VendureEvent, Injector } from '@vendure/core';
import { StellateService } from './service/stellate.service';
/**
 * @description
 * Configures a {@link PurgeRule}.
 *
 * @docsCategory core plugins/StellatePlugin
 * @docsPage PurgeRule
 */
export interface PurgeRuleConfig<Event extends VendureEvent> {
    /**
     * @description
     * Specifies which VendureEvent will trigger this purge rule.
     */
    eventType: Type<Event>;
    /**
     * @description
     * How long to buffer events for in milliseconds before executing the handler. This allows
     * us to efficiently batch calls to the Stellate Purge API.
     *
     * @default 5000
     */
    bufferTime?: number;
    /**
     * @description
     * The function to invoke when the specified event is published. This function should use the
     * {@link StellateService} instance to call the Stellate Purge API.
     */
    handler: (handlerArgs: {
        events: Event[];
        stellateService: StellateService;
        injector: Injector;
    }) => void | Promise<void>;
}
/**
 * @description
 * Defines a rule that listens for a particular VendureEvent and uses that to
 * make calls to the [Stellate Purging API](https://docs.stellate.co/docs/purging-api) via
 * the provided {@link StellateService} instance.
 *
 * @docsCategory core plugins/StellatePlugin
 * @docsPage PurgeRule
 * @docsWeight 0
 */
export declare class PurgeRule<Event extends VendureEvent = VendureEvent> {
    private config;
    get eventType(): Type<Event>;
    get bufferTimeMs(): number | undefined;
    handle(handlerArgs: {
        events: Event[];
        stellateService: StellateService;
        injector: Injector;
    }): void | Promise<void>;
    constructor(config: PurgeRuleConfig<Event>);
}
