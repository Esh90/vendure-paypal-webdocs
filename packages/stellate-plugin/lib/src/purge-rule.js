"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurgeRule = void 0;
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
class PurgeRule {
    get eventType() {
        return this.config.eventType;
    }
    get bufferTimeMs() {
        return this.config.bufferTime;
    }
    handle(handlerArgs) {
        return this.config.handler(handlerArgs);
    }
    constructor(config) {
        this.config = config;
    }
}
exports.PurgeRule = PurgeRule;
//# sourceMappingURL=purge-rule.js.map