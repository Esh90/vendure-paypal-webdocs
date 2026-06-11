import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * @description
 * Tracks a PayPal subscription within Vendure. PayPal owns the authoritative subscription state;
 * this entity is a local mirror that lets the merchant list and manage subscriptions from the admin
 * without paginating PayPal on every request, and is kept in sync by {@link paypalSubscriptionSyncTask}.
 */
@Entity()
export class PayPalSubscription extends VendureEntity {
    constructor(input?: DeepPartial<PayPalSubscription>) {
        super(input);
    }

    /** The PayPal-generated subscription ID (e.g. `I-BW452GLLEP1G`). */
    @Index({ unique: true })
    @Column()
    paypalSubscriptionId: string;

    /** The PayPal billing plan ID this subscription is based on. */
    @Column()
    planId: string;

    /**
     * The PayPal subscription status: `APPROVAL_PENDING`, `APPROVED`, `ACTIVE`, `SUSPENDED`,
     * `CANCELLED` or `EXPIRED`.
     */
    @Column()
    status: string;

    /** The email address of the subscriber, when known. */
    @Column({ nullable: true })
    subscriberEmail?: string;

    /** An optional custom identifier supplied when the subscription was created (e.g. order code). */
    @Column({ nullable: true })
    customId?: string;

    /** The scheduled start time of the subscription, in ISO-8601 format, when known. */
    @Column({ nullable: true })
    startTime?: string;
}
