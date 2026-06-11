import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
    EventBus,
    Fulfillment,
    FulfillmentService,
    FulfillmentStateTransitionEvent,
    ID,
    Logger,
    Order,
    OrderLine,
    OrderService,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';
import { OrderTrackerRequest, ShipmentCarrier } from '@paypal/paypal-server-sdk';
import { In } from 'typeorm';

import { loggerCtx } from '../constants';
import { toReadablePayPalError } from '../paypal-errors';
import { PayPalClientService } from '../paypal.client';
import { PayPalPaymentMetadata } from '../types';

/**
 * @description
 * Implements the fulfillment hook (Use Case 8). It subscribes to {@link FulfillmentStateTransitionEvent}
 * and, when a fulfillment becomes shipped, pushes the carrier and tracking number to PayPal so the
 * buyer can see shipment tracking in their PayPal account.
 *
 * No custom endpoints or entities are required — the PayPal order ID and capture ID are read from
 * the metadata stored on the order's PayPal payment by the {@link paypalPaymentHandler}.
 */
@Injectable()
export class PayPalTrackingService implements OnApplicationBootstrap {
    constructor(
        private readonly eventBus: EventBus,
        private readonly orderService: OrderService,
        private readonly fulfillmentService: FulfillmentService,
        private readonly connection: TransactionalConnection,
        private readonly clientService: PayPalClientService,
    ) {}

    onApplicationBootstrap(): void {
        this.eventBus.ofType(FulfillmentStateTransitionEvent).subscribe(event => {
            const from = event.fromState as string;
            const to = event.toState as string;
            // Push tracking once the fulfillment is shipped. If a process goes straight to
            // "Delivered" without a "Shipped" step, push then instead, avoiding a duplicate push.
            const shouldPush = to === 'Shipped' || (to === 'Delivered' && from !== 'Shipped');
            if (!shouldPush) {
                return;
            }
            this.handleShipment(event.ctx, event.fulfillment).catch(e => {
                Logger.error(
                    `Unexpected error while pushing tracking for fulfillment ${event.fulfillment.id}: ${
                        e instanceof Error ? e.message : String(e)
                    }`,
                    loggerCtx,
                );
            });
        });
    }

    private async handleShipment(ctx: RequestContext, fulfillment: Fulfillment): Promise<void> {
        if (!fulfillment.trackingCode) {
            Logger.debug(
                `Fulfillment ${fulfillment.id} has no tracking code; nothing to push to PayPal`,
                loggerCtx,
            );
            return;
        }
        const orderIds = await this.getOrderIdsForFulfillment(ctx, fulfillment.id);
        for (const orderId of orderIds) {
            const order = await this.orderService.findOne(ctx, orderId, ['payments']);
            if (!order) {
                continue;
            }
            const payment = order.payments?.find(p => {
                const metadata = p.metadata as Partial<PayPalPaymentMetadata> | undefined;
                return (
                    typeof metadata?.paypalOrderId === 'string' &&
                    typeof metadata?.captureId === 'string'
                );
            });
            if (!payment) {
                // Not paid (or not captured) via PayPal — nothing to track.
                continue;
            }
            const metadata = payment.metadata as PayPalPaymentMetadata;
            await this.pushTracking(order, metadata.paypalOrderId, metadata.captureId as string, fulfillment);
        }
    }

    private async getOrderIdsForFulfillment(ctx: RequestContext, fulfillmentId: ID): Promise<ID[]> {
        const fulfillmentLines = await this.fulfillmentService.getFulfillmentLines(ctx, fulfillmentId);
        const orderLineIds = Array.from(new Set(fulfillmentLines.map(line => line.orderLineId)));
        if (orderLineIds.length === 0) {
            return [];
        }
        const orderLines = await this.connection.getRepository(ctx, OrderLine).find({
            where: { id: In(orderLineIds) },
            relations: ['order'],
        });
        return Array.from(new Set(orderLines.map(line => line.order.id)));
    }

    private async pushTracking(
        order: Order,
        paypalOrderId: string,
        captureId: string,
        fulfillment: Fulfillment,
    ): Promise<void> {
        const { carrier, carrierNameOther } = this.resolveCarrier(fulfillment.method);
        const body: OrderTrackerRequest = {
            captureId,
            trackingNumber: fulfillment.trackingCode,
            carrier,
            notifyPayer: true,
            ...(carrierNameOther ? { carrierNameOther } : {}),
        };
        try {
            await this.clientService.getOrdersController().createOrderTracking({ id: paypalOrderId, body });
            Logger.info(
                `Pushed tracking ${fulfillment.trackingCode} (${carrier}) to PayPal order ` +
                    `${paypalOrderId} for Vendure order ${order.code}`,
                loggerCtx,
            );
        } catch (e) {
            // Log and swallow: a tracking-push failure must not interrupt the fulfillment flow.
            toReadablePayPalError(e, `add tracking to PayPal order ${paypalOrderId}`, loggerCtx);
        }
    }

    /**
     * Maps a Vendure fulfillment method to a PayPal {@link ShipmentCarrier}. If the method matches a
     * known carrier code (case/separator-insensitive) it is used directly; otherwise the carrier is
     * reported as `OTHER` with the method name preserved in `carrier_name_other`.
     */
    private resolveCarrier(method?: string): { carrier: ShipmentCarrier; carrierNameOther?: string } {
        const raw = (method ?? '').trim();
        if (raw) {
            const key = raw.toUpperCase().replace(/[\s-]+/g, '_');
            if ((Object.values(ShipmentCarrier) as string[]).includes(key)) {
                return { carrier: key as ShipmentCarrier };
            }
        }
        return { carrier: ShipmentCarrier.Other, carrierNameOther: raw || 'Other' };
    }
}
