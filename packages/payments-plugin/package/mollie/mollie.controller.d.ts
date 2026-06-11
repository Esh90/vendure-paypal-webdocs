import { ChannelService } from '@vendure/core';
import { Request } from 'express';
import { MollieService } from './mollie.service';
export declare class MollieController {
    private mollieService;
    private channelService;
    constructor(mollieService: MollieService, channelService: ChannelService);
    webhook(channelToken: string, paymentMethodId: string, body: any, req: Request): Promise<void>;
    private createContext;
}
