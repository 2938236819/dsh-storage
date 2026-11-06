import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
/**
 * Model AiChatHistory
 * Per-session rollup, maintained incrementally by the projector.
 */
export type AiChatHistoryModel = runtime.Types.Result.DefaultSelection<Prisma.$AiChatHistoryPayload>;
export type AggregateAiChatHistory = {
    _count: AiChatHistoryCountAggregateOutputType | null;
    _avg: AiChatHistoryAvgAggregateOutputType | null;
    _sum: AiChatHistorySumAggregateOutputType | null;
    _min: AiChatHistoryMinAggregateOutputType | null;
    _max: AiChatHistoryMaxAggregateOutputType | null;
};
export type AiChatHistoryAvgAggregateOutputType = {
    messageCount: number | null;
    totalTokens: number | null;
};
export type AiChatHistorySumAggregateOutputType = {
    messageCount: number | null;
    totalTokens: bigint | null;
};
export type AiChatHistoryMinAggregateOutputType = {
    id: string | null;
    sessionId: string | null;
    title: string | null;
    summary: string | null;
    messageCount: number | null;
    totalTokens: bigint | null;
    firstMessageAt: Date | null;
    lastMessageAt: Date | null;
    deletedAt: Date | null;
};
export type AiChatHistoryMaxAggregateOutputType = {
    id: string | null;
    sessionId: string | null;
    title: string | null;
    summary: string | null;
    messageCount: number | null;
    totalTokens: bigint | null;
    firstMessageAt: Date | null;
    lastMessageAt: Date | null;
    deletedAt: Date | null;
};
export type AiChatHistoryCountAggregateOutputType = {
    id: number;
    sessionId: number;
    title: number;
    summary: number;
    messageCount: number;
    totalTokens: number;
    firstMessageAt: number;
    lastMessageAt: number;
    metadata: number;
    deletedAt: number;
    _all: number;
};
export type AiChatHistoryAvgAggregateInputType = {
    messageCount?: true;
    totalTokens?: true;
};
export type AiChatHistorySumAggregateInputType = {
    messageCount?: true;
    totalTokens?: true;
};
export type AiChatHistoryMinAggregateInputType = {
    id?: true;
    sessionId?: true;
    title?: true;
    summary?: true;
    messageCount?: true;
    totalTokens?: true;
    firstMessageAt?: true;
    lastMessageAt?: true;
    deletedAt?: true;
};
export type AiChatHistoryMaxAggregateInputType = {
    id?: true;
    sessionId?: true;
    title?: true;
    summary?: true;
    messageCount?: true;
    totalTokens?: true;
    firstMessageAt?: true;
    lastMessageAt?: true;
    deletedAt?: true;
};
export type AiChatHistoryCountAggregateInputType = {
    id?: true;
    sessionId?: true;
    title?: true;
    summary?: true;
    messageCount?: true;
    totalTokens?: true;
    firstMessageAt?: true;
    lastMessageAt?: true;
    metadata?: true;
    deletedAt?: true;
    _all?: true;
};
export type AiChatHistoryAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Filter which AiChatHistory to aggregate.
     */
    where?: Prisma.AiChatHistoryWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of AiChatHistories to fetch.
     */
    orderBy?: Prisma.AiChatHistoryOrderByWithRelationInput | Prisma.AiChatHistoryOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: Prisma.AiChatHistoryWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` AiChatHistories from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` AiChatHistories.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned AiChatHistories
    **/
    _count?: true | AiChatHistoryCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
    **/
    _avg?: AiChatHistoryAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
    **/
    _sum?: AiChatHistorySumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
    **/
    _min?: AiChatHistoryMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
    **/
    _max?: AiChatHistoryMaxAggregateInputType;
};
export type GetAiChatHistoryAggregateType<T extends AiChatHistoryAggregateArgs> = {
    [P in keyof T & keyof AggregateAiChatHistory]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateAiChatHistory[P]> : Prisma.GetScalarType<T[P], AggregateAiChatHistory[P]>;
};
export type AiChatHistoryGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.AiChatHistoryWhereInput;
    orderBy?: Prisma.AiChatHistoryOrderByWithAggregationInput | Prisma.AiChatHistoryOrderByWithAggregationInput[];
    by: Prisma.AiChatHistoryScalarFieldEnum[] | Prisma.AiChatHistoryScalarFieldEnum;
    having?: Prisma.AiChatHistoryScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: AiChatHistoryCountAggregateInputType | true;
    _avg?: AiChatHistoryAvgAggregateInputType;
    _sum?: AiChatHistorySumAggregateInputType;
    _min?: AiChatHistoryMinAggregateInputType;
    _max?: AiChatHistoryMaxAggregateInputType;
};
export type AiChatHistoryGroupByOutputType = {
    id: string;
    sessionId: string;
    title: string | null;
    summary: string | null;
    messageCount: number;
    totalTokens: bigint;
    firstMessageAt: Date | null;
    lastMessageAt: Date | null;
    metadata: runtime.JsonValue | null;
    deletedAt: Date | null;
    _count: AiChatHistoryCountAggregateOutputType | null;
    _avg: AiChatHistoryAvgAggregateOutputType | null;
    _sum: AiChatHistorySumAggregateOutputType | null;
    _min: AiChatHistoryMinAggregateOutputType | null;
    _max: AiChatHistoryMaxAggregateOutputType | null;
};
export type GetAiChatHistoryGroupByPayload<T extends AiChatHistoryGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<AiChatHistoryGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof AiChatHistoryGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], AiChatHistoryGroupByOutputType[P]> : Prisma.GetScalarType<T[P], AiChatHistoryGroupByOutputType[P]>;
}>>;
export type AiChatHistoryWhereInput = {
    AND?: Prisma.AiChatHistoryWhereInput | Prisma.AiChatHistoryWhereInput[];
    OR?: Prisma.AiChatHistoryWhereInput[];
    NOT?: Prisma.AiChatHistoryWhereInput | Prisma.AiChatHistoryWhereInput[];
    id?: Prisma.StringFilter<"AiChatHistory"> | string;
    sessionId?: Prisma.StringFilter<"AiChatHistory"> | string;
    title?: Prisma.StringNullableFilter<"AiChatHistory"> | string | null;
    summary?: Prisma.StringNullableFilter<"AiChatHistory"> | string | null;
    messageCount?: Prisma.IntFilter<"AiChatHistory"> | number;
    totalTokens?: Prisma.BigIntFilter<"AiChatHistory"> | bigint | number;
    firstMessageAt?: Prisma.DateTimeNullableFilter<"AiChatHistory"> | Date | string | null;
    lastMessageAt?: Prisma.DateTimeNullableFilter<"AiChatHistory"> | Date | string | null;
    metadata?: Prisma.JsonNullableFilter<"AiChatHistory">;
    deletedAt?: Prisma.DateTimeNullableFilter<"AiChatHistory"> | Date | string | null;
    messages?: Prisma.AiMessageListRelationFilter;
};
export type AiChatHistoryOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    sessionId?: Prisma.SortOrder;
    title?: Prisma.SortOrderInput | Prisma.SortOrder;
    summary?: Prisma.SortOrderInput | Prisma.SortOrder;
    messageCount?: Prisma.SortOrder;
    totalTokens?: Prisma.SortOrder;
    firstMessageAt?: Prisma.SortOrderInput | Prisma.SortOrder;
    lastMessageAt?: Prisma.SortOrderInput | Prisma.SortOrder;
    metadata?: Prisma.SortOrderInput | Prisma.SortOrder;
    deletedAt?: Prisma.SortOrderInput | Prisma.SortOrder;
    messages?: Prisma.AiMessageOrderByRelationAggregateInput;
};
export type AiChatHistoryWhereUniqueInput = Prisma.AtLeast<{
    id?: string;
    AND?: Prisma.AiChatHistoryWhereInput | Prisma.AiChatHistoryWhereInput[];
    OR?: Prisma.AiChatHistoryWhereInput[];
    NOT?: Prisma.AiChatHistoryWhereInput | Prisma.AiChatHistoryWhereInput[];
    sessionId?: Prisma.StringFilter<"AiChatHistory"> | string;
    title?: Prisma.StringNullableFilter<"AiChatHistory"> | string | null;
    summary?: Prisma.StringNullableFilter<"AiChatHistory"> | string | null;
    messageCount?: Prisma.IntFilter<"AiChatHistory"> | number;
    totalTokens?: Prisma.BigIntFilter<"AiChatHistory"> | bigint | number;
    firstMessageAt?: Prisma.DateTimeNullableFilter<"AiChatHistory"> | Date | string | null;
    lastMessageAt?: Prisma.DateTimeNullableFilter<"AiChatHistory"> | Date | string | null;
    metadata?: Prisma.JsonNullableFilter<"AiChatHistory">;
    deletedAt?: Prisma.DateTimeNullableFilter<"AiChatHistory"> | Date | string | null;
    messages?: Prisma.AiMessageListRelationFilter;
}, "id">;
export type AiChatHistoryOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    sessionId?: Prisma.SortOrder;
    title?: Prisma.SortOrderInput | Prisma.SortOrder;
    summary?: Prisma.SortOrderInput | Prisma.SortOrder;
    messageCount?: Prisma.SortOrder;
    totalTokens?: Prisma.SortOrder;
    firstMessageAt?: Prisma.SortOrderInput | Prisma.SortOrder;
    lastMessageAt?: Prisma.SortOrderInput | Prisma.SortOrder;
    metadata?: Prisma.SortOrderInput | Prisma.SortOrder;
    deletedAt?: Prisma.SortOrderInput | Prisma.SortOrder;
    _count?: Prisma.AiChatHistoryCountOrderByAggregateInput;
    _avg?: Prisma.AiChatHistoryAvgOrderByAggregateInput;
    _max?: Prisma.AiChatHistoryMaxOrderByAggregateInput;
    _min?: Prisma.AiChatHistoryMinOrderByAggregateInput;
    _sum?: Prisma.AiChatHistorySumOrderByAggregateInput;
};
export type AiChatHistoryScalarWhereWithAggregatesInput = {
    AND?: Prisma.AiChatHistoryScalarWhereWithAggregatesInput | Prisma.AiChatHistoryScalarWhereWithAggregatesInput[];
    OR?: Prisma.AiChatHistoryScalarWhereWithAggregatesInput[];
    NOT?: Prisma.AiChatHistoryScalarWhereWithAggregatesInput | Prisma.AiChatHistoryScalarWhereWithAggregatesInput[];
    id?: Prisma.StringWithAggregatesFilter<"AiChatHistory"> | string;
    sessionId?: Prisma.StringWithAggregatesFilter<"AiChatHistory"> | string;
    title?: Prisma.StringNullableWithAggregatesFilter<"AiChatHistory"> | string | null;
    summary?: Prisma.StringNullableWithAggregatesFilter<"AiChatHistory"> | string | null;
    messageCount?: Prisma.IntWithAggregatesFilter<"AiChatHistory"> | number;
    totalTokens?: Prisma.BigIntWithAggregatesFilter<"AiChatHistory"> | bigint | number;
    firstMessageAt?: Prisma.DateTimeNullableWithAggregatesFilter<"AiChatHistory"> | Date | string | null;
    lastMessageAt?: Prisma.DateTimeNullableWithAggregatesFilter<"AiChatHistory"> | Date | string | null;
    metadata?: Prisma.JsonNullableWithAggregatesFilter<"AiChatHistory">;
    deletedAt?: Prisma.DateTimeNullableWithAggregatesFilter<"AiChatHistory"> | Date | string | null;
};
export type AiChatHistoryCreateInput = {
    id?: string;
    sessionId: string;
    title?: string | null;
    summary?: string | null;
    messageCount?: number;
    totalTokens?: bigint | number;
    firstMessageAt?: Date | string | null;
    lastMessageAt?: Date | string | null;
    metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    deletedAt?: Date | string | null;
    messages?: Prisma.AiMessageCreateNestedManyWithoutHistoryInput;
};
export type AiChatHistoryUncheckedCreateInput = {
    id?: string;
    sessionId: string;
    title?: string | null;
    summary?: string | null;
    messageCount?: number;
    totalTokens?: bigint | number;
    firstMessageAt?: Date | string | null;
    lastMessageAt?: Date | string | null;
    metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    deletedAt?: Date | string | null;
    messages?: Prisma.AiMessageUncheckedCreateNestedManyWithoutHistoryInput;
};
export type AiChatHistoryUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    sessionId?: Prisma.StringFieldUpdateOperationsInput | string;
    title?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    summary?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    messageCount?: Prisma.IntFieldUpdateOperationsInput | number;
    totalTokens?: Prisma.BigIntFieldUpdateOperationsInput | bigint | number;
    firstMessageAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    lastMessageAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    messages?: Prisma.AiMessageUpdateManyWithoutHistoryNestedInput;
};
export type AiChatHistoryUncheckedUpdateInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    sessionId?: Prisma.StringFieldUpdateOperationsInput | string;
    title?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    summary?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    messageCount?: Prisma.IntFieldUpdateOperationsInput | number;
    totalTokens?: Prisma.BigIntFieldUpdateOperationsInput | bigint | number;
    firstMessageAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    lastMessageAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    messages?: Prisma.AiMessageUncheckedUpdateManyWithoutHistoryNestedInput;
};
export type AiChatHistoryCreateManyInput = {
    id?: string;
    sessionId: string;
    title?: string | null;
    summary?: string | null;
    messageCount?: number;
    totalTokens?: bigint | number;
    firstMessageAt?: Date | string | null;
    lastMessageAt?: Date | string | null;
    metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    deletedAt?: Date | string | null;
};
export type AiChatHistoryUpdateManyMutationInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    sessionId?: Prisma.StringFieldUpdateOperationsInput | string;
    title?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    summary?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    messageCount?: Prisma.IntFieldUpdateOperationsInput | number;
    totalTokens?: Prisma.BigIntFieldUpdateOperationsInput | bigint | number;
    firstMessageAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    lastMessageAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
};
export type AiChatHistoryUncheckedUpdateManyInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    sessionId?: Prisma.StringFieldUpdateOperationsInput | string;
    title?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    summary?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    messageCount?: Prisma.IntFieldUpdateOperationsInput | number;
    totalTokens?: Prisma.BigIntFieldUpdateOperationsInput | bigint | number;
    firstMessageAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    lastMessageAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
};
export type AiChatHistoryNullableScalarRelationFilter = {
    is?: Prisma.AiChatHistoryWhereInput | null;
    isNot?: Prisma.AiChatHistoryWhereInput | null;
};
export type AiChatHistoryCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    sessionId?: Prisma.SortOrder;
    title?: Prisma.SortOrder;
    summary?: Prisma.SortOrder;
    messageCount?: Prisma.SortOrder;
    totalTokens?: Prisma.SortOrder;
    firstMessageAt?: Prisma.SortOrder;
    lastMessageAt?: Prisma.SortOrder;
    metadata?: Prisma.SortOrder;
    deletedAt?: Prisma.SortOrder;
};
export type AiChatHistoryAvgOrderByAggregateInput = {
    messageCount?: Prisma.SortOrder;
    totalTokens?: Prisma.SortOrder;
};
export type AiChatHistoryMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    sessionId?: Prisma.SortOrder;
    title?: Prisma.SortOrder;
    summary?: Prisma.SortOrder;
    messageCount?: Prisma.SortOrder;
    totalTokens?: Prisma.SortOrder;
    firstMessageAt?: Prisma.SortOrder;
    lastMessageAt?: Prisma.SortOrder;
    deletedAt?: Prisma.SortOrder;
};
export type AiChatHistoryMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    sessionId?: Prisma.SortOrder;
    title?: Prisma.SortOrder;
    summary?: Prisma.SortOrder;
    messageCount?: Prisma.SortOrder;
    totalTokens?: Prisma.SortOrder;
    firstMessageAt?: Prisma.SortOrder;
    lastMessageAt?: Prisma.SortOrder;
    deletedAt?: Prisma.SortOrder;
};
export type AiChatHistorySumOrderByAggregateInput = {
    messageCount?: Prisma.SortOrder;
    totalTokens?: Prisma.SortOrder;
};
export type AiChatHistoryCreateNestedOneWithoutMessagesInput = {
    create?: Prisma.XOR<Prisma.AiChatHistoryCreateWithoutMessagesInput, Prisma.AiChatHistoryUncheckedCreateWithoutMessagesInput>;
    connectOrCreate?: Prisma.AiChatHistoryCreateOrConnectWithoutMessagesInput;
    connect?: Prisma.AiChatHistoryWhereUniqueInput;
};
export type AiChatHistoryUpdateOneWithoutMessagesNestedInput = {
    create?: Prisma.XOR<Prisma.AiChatHistoryCreateWithoutMessagesInput, Prisma.AiChatHistoryUncheckedCreateWithoutMessagesInput>;
    connectOrCreate?: Prisma.AiChatHistoryCreateOrConnectWithoutMessagesInput;
    upsert?: Prisma.AiChatHistoryUpsertWithoutMessagesInput;
    disconnect?: Prisma.AiChatHistoryWhereInput | boolean;
    delete?: Prisma.AiChatHistoryWhereInput | boolean;
    connect?: Prisma.AiChatHistoryWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.AiChatHistoryUpdateToOneWithWhereWithoutMessagesInput, Prisma.AiChatHistoryUpdateWithoutMessagesInput>, Prisma.AiChatHistoryUncheckedUpdateWithoutMessagesInput>;
};
export type IntFieldUpdateOperationsInput = {
    set?: number;
    increment?: number;
    decrement?: number;
    multiply?: number;
    divide?: number;
};
export type BigIntFieldUpdateOperationsInput = {
    set?: bigint | number;
    increment?: bigint | number;
    decrement?: bigint | number;
    multiply?: bigint | number;
    divide?: bigint | number;
};
export type AiChatHistoryCreateWithoutMessagesInput = {
    id?: string;
    sessionId: string;
    title?: string | null;
    summary?: string | null;
    messageCount?: number;
    totalTokens?: bigint | number;
    firstMessageAt?: Date | string | null;
    lastMessageAt?: Date | string | null;
    metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    deletedAt?: Date | string | null;
};
export type AiChatHistoryUncheckedCreateWithoutMessagesInput = {
    id?: string;
    sessionId: string;
    title?: string | null;
    summary?: string | null;
    messageCount?: number;
    totalTokens?: bigint | number;
    firstMessageAt?: Date | string | null;
    lastMessageAt?: Date | string | null;
    metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    deletedAt?: Date | string | null;
};
export type AiChatHistoryCreateOrConnectWithoutMessagesInput = {
    where: Prisma.AiChatHistoryWhereUniqueInput;
    create: Prisma.XOR<Prisma.AiChatHistoryCreateWithoutMessagesInput, Prisma.AiChatHistoryUncheckedCreateWithoutMessagesInput>;
};
export type AiChatHistoryUpsertWithoutMessagesInput = {
    update: Prisma.XOR<Prisma.AiChatHistoryUpdateWithoutMessagesInput, Prisma.AiChatHistoryUncheckedUpdateWithoutMessagesInput>;
    create: Prisma.XOR<Prisma.AiChatHistoryCreateWithoutMessagesInput, Prisma.AiChatHistoryUncheckedCreateWithoutMessagesInput>;
    where?: Prisma.AiChatHistoryWhereInput;
};
export type AiChatHistoryUpdateToOneWithWhereWithoutMessagesInput = {
    where?: Prisma.AiChatHistoryWhereInput;
    data: Prisma.XOR<Prisma.AiChatHistoryUpdateWithoutMessagesInput, Prisma.AiChatHistoryUncheckedUpdateWithoutMessagesInput>;
};
export type AiChatHistoryUpdateWithoutMessagesInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    sessionId?: Prisma.StringFieldUpdateOperationsInput | string;
    title?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    summary?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    messageCount?: Prisma.IntFieldUpdateOperationsInput | number;
    totalTokens?: Prisma.BigIntFieldUpdateOperationsInput | bigint | number;
    firstMessageAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    lastMessageAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
};
export type AiChatHistoryUncheckedUpdateWithoutMessagesInput = {
    id?: Prisma.StringFieldUpdateOperationsInput | string;
    sessionId?: Prisma.StringFieldUpdateOperationsInput | string;
    title?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    summary?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    messageCount?: Prisma.IntFieldUpdateOperationsInput | number;
    totalTokens?: Prisma.BigIntFieldUpdateOperationsInput | bigint | number;
    firstMessageAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    lastMessageAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    metadata?: Prisma.NullableJsonNullValueInput | runtime.InputJsonValue;
    deletedAt?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
};
/**
 * Count Type AiChatHistoryCountOutputType
 */
export type AiChatHistoryCountOutputType = {
    messages: number;
};
export type AiChatHistoryCountOutputTypeSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    messages?: boolean | AiChatHistoryCountOutputTypeCountMessagesArgs;
};
/**
 * AiChatHistoryCountOutputType without action
 */
export type AiChatHistoryCountOutputTypeDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AiChatHistoryCountOutputType
     */
    select?: Prisma.AiChatHistoryCountOutputTypeSelect<ExtArgs> | null;
};
/**
 * AiChatHistoryCountOutputType without action
 */
export type AiChatHistoryCountOutputTypeCountMessagesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.AiMessageWhereInput;
};
export type AiChatHistorySelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    sessionId?: boolean;
    title?: boolean;
    summary?: boolean;
    messageCount?: boolean;
    totalTokens?: boolean;
    firstMessageAt?: boolean;
    lastMessageAt?: boolean;
    metadata?: boolean;
    deletedAt?: boolean;
    messages?: boolean | Prisma.AiChatHistory$messagesArgs<ExtArgs>;
    _count?: boolean | Prisma.AiChatHistoryCountOutputTypeDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["aiChatHistory"]>;
export type AiChatHistorySelectCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    sessionId?: boolean;
    title?: boolean;
    summary?: boolean;
    messageCount?: boolean;
    totalTokens?: boolean;
    firstMessageAt?: boolean;
    lastMessageAt?: boolean;
    metadata?: boolean;
    deletedAt?: boolean;
}, ExtArgs["result"]["aiChatHistory"]>;
export type AiChatHistorySelectUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    sessionId?: boolean;
    title?: boolean;
    summary?: boolean;
    messageCount?: boolean;
    totalTokens?: boolean;
    firstMessageAt?: boolean;
    lastMessageAt?: boolean;
    metadata?: boolean;
    deletedAt?: boolean;
}, ExtArgs["result"]["aiChatHistory"]>;
export type AiChatHistorySelectScalar = {
    id?: boolean;
    sessionId?: boolean;
    title?: boolean;
    summary?: boolean;
    messageCount?: boolean;
    totalTokens?: boolean;
    firstMessageAt?: boolean;
    lastMessageAt?: boolean;
    metadata?: boolean;
    deletedAt?: boolean;
};
export type AiChatHistoryOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "sessionId" | "title" | "summary" | "messageCount" | "totalTokens" | "firstMessageAt" | "lastMessageAt" | "metadata" | "deletedAt", ExtArgs["result"]["aiChatHistory"]>;
export type AiChatHistoryInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    messages?: boolean | Prisma.AiChatHistory$messagesArgs<ExtArgs>;
    _count?: boolean | Prisma.AiChatHistoryCountOutputTypeDefaultArgs<ExtArgs>;
};
export type AiChatHistoryIncludeCreateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {};
export type AiChatHistoryIncludeUpdateManyAndReturn<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {};
export type $AiChatHistoryPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "AiChatHistory";
    objects: {
        messages: Prisma.$AiMessagePayload<ExtArgs>[];
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: string;
        sessionId: string;
        title: string | null;
        summary: string | null;
        messageCount: number;
        totalTokens: bigint;
        firstMessageAt: Date | null;
        lastMessageAt: Date | null;
        metadata: runtime.JsonValue | null;
        deletedAt: Date | null;
    }, ExtArgs["result"]["aiChatHistory"]>;
    composites: {};
};
export type AiChatHistoryGetPayload<S extends boolean | null | undefined | AiChatHistoryDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$AiChatHistoryPayload, S>;
export type AiChatHistoryCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<AiChatHistoryFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: AiChatHistoryCountAggregateInputType | true;
};
export interface AiChatHistoryDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['AiChatHistory'];
        meta: {
            name: 'AiChatHistory';
        };
    };
    /**
     * Find zero or one AiChatHistory that matches the filter.
     * @param {AiChatHistoryFindUniqueArgs} args - Arguments to find a AiChatHistory
     * @example
     * // Get one AiChatHistory
     * const aiChatHistory = await prisma.aiChatHistory.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AiChatHistoryFindUniqueArgs>(args: Prisma.SelectSubset<T, AiChatHistoryFindUniqueArgs<ExtArgs>>): Prisma.Prisma__AiChatHistoryClient<runtime.Types.Result.GetResult<Prisma.$AiChatHistoryPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    /**
     * Find one AiChatHistory that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {AiChatHistoryFindUniqueOrThrowArgs} args - Arguments to find a AiChatHistory
     * @example
     * // Get one AiChatHistory
     * const aiChatHistory = await prisma.aiChatHistory.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AiChatHistoryFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, AiChatHistoryFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__AiChatHistoryClient<runtime.Types.Result.GetResult<Prisma.$AiChatHistoryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Find the first AiChatHistory that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AiChatHistoryFindFirstArgs} args - Arguments to find a AiChatHistory
     * @example
     * // Get one AiChatHistory
     * const aiChatHistory = await prisma.aiChatHistory.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AiChatHistoryFindFirstArgs>(args?: Prisma.SelectSubset<T, AiChatHistoryFindFirstArgs<ExtArgs>>): Prisma.Prisma__AiChatHistoryClient<runtime.Types.Result.GetResult<Prisma.$AiChatHistoryPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    /**
     * Find the first AiChatHistory that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AiChatHistoryFindFirstOrThrowArgs} args - Arguments to find a AiChatHistory
     * @example
     * // Get one AiChatHistory
     * const aiChatHistory = await prisma.aiChatHistory.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AiChatHistoryFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, AiChatHistoryFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__AiChatHistoryClient<runtime.Types.Result.GetResult<Prisma.$AiChatHistoryPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Find zero or more AiChatHistories that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AiChatHistoryFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all AiChatHistories
     * const aiChatHistories = await prisma.aiChatHistory.findMany()
     *
     * // Get first 10 AiChatHistories
     * const aiChatHistories = await prisma.aiChatHistory.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const aiChatHistoryWithIdOnly = await prisma.aiChatHistory.findMany({ select: { id: true } })
     *
     */
    findMany<T extends AiChatHistoryFindManyArgs>(args?: Prisma.SelectSubset<T, AiChatHistoryFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$AiChatHistoryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    /**
     * Create a AiChatHistory.
     * @param {AiChatHistoryCreateArgs} args - Arguments to create a AiChatHistory.
     * @example
     * // Create one AiChatHistory
     * const AiChatHistory = await prisma.aiChatHistory.create({
     *   data: {
     *     // ... data to create a AiChatHistory
     *   }
     * })
     *
     */
    create<T extends AiChatHistoryCreateArgs>(args: Prisma.SelectSubset<T, AiChatHistoryCreateArgs<ExtArgs>>): Prisma.Prisma__AiChatHistoryClient<runtime.Types.Result.GetResult<Prisma.$AiChatHistoryPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Create many AiChatHistories.
     * @param {AiChatHistoryCreateManyArgs} args - Arguments to create many AiChatHistories.
     * @example
     * // Create many AiChatHistories
     * const aiChatHistory = await prisma.aiChatHistory.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends AiChatHistoryCreateManyArgs>(args?: Prisma.SelectSubset<T, AiChatHistoryCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Create many AiChatHistories and returns the data saved in the database.
     * @param {AiChatHistoryCreateManyAndReturnArgs} args - Arguments to create many AiChatHistories.
     * @example
     * // Create many AiChatHistories
     * const aiChatHistory = await prisma.aiChatHistory.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many AiChatHistories and only return the `id`
     * const aiChatHistoryWithIdOnly = await prisma.aiChatHistory.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends AiChatHistoryCreateManyAndReturnArgs>(args?: Prisma.SelectSubset<T, AiChatHistoryCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$AiChatHistoryPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>;
    /**
     * Delete a AiChatHistory.
     * @param {AiChatHistoryDeleteArgs} args - Arguments to delete one AiChatHistory.
     * @example
     * // Delete one AiChatHistory
     * const AiChatHistory = await prisma.aiChatHistory.delete({
     *   where: {
     *     // ... filter to delete one AiChatHistory
     *   }
     * })
     *
     */
    delete<T extends AiChatHistoryDeleteArgs>(args: Prisma.SelectSubset<T, AiChatHistoryDeleteArgs<ExtArgs>>): Prisma.Prisma__AiChatHistoryClient<runtime.Types.Result.GetResult<Prisma.$AiChatHistoryPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Update one AiChatHistory.
     * @param {AiChatHistoryUpdateArgs} args - Arguments to update one AiChatHistory.
     * @example
     * // Update one AiChatHistory
     * const aiChatHistory = await prisma.aiChatHistory.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends AiChatHistoryUpdateArgs>(args: Prisma.SelectSubset<T, AiChatHistoryUpdateArgs<ExtArgs>>): Prisma.Prisma__AiChatHistoryClient<runtime.Types.Result.GetResult<Prisma.$AiChatHistoryPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Delete zero or more AiChatHistories.
     * @param {AiChatHistoryDeleteManyArgs} args - Arguments to filter AiChatHistories to delete.
     * @example
     * // Delete a few AiChatHistories
     * const { count } = await prisma.aiChatHistory.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends AiChatHistoryDeleteManyArgs>(args?: Prisma.SelectSubset<T, AiChatHistoryDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Update zero or more AiChatHistories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AiChatHistoryUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many AiChatHistories
     * const aiChatHistory = await prisma.aiChatHistory.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends AiChatHistoryUpdateManyArgs>(args: Prisma.SelectSubset<T, AiChatHistoryUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    /**
     * Update zero or more AiChatHistories and returns the data updated in the database.
     * @param {AiChatHistoryUpdateManyAndReturnArgs} args - Arguments to update many AiChatHistories.
     * @example
     * // Update many AiChatHistories
     * const aiChatHistory = await prisma.aiChatHistory.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more AiChatHistories and only return the `id`
     * const aiChatHistoryWithIdOnly = await prisma.aiChatHistory.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends AiChatHistoryUpdateManyAndReturnArgs>(args: Prisma.SelectSubset<T, AiChatHistoryUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$AiChatHistoryPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>;
    /**
     * Create or update one AiChatHistory.
     * @param {AiChatHistoryUpsertArgs} args - Arguments to update or create a AiChatHistory.
     * @example
     * // Update or create a AiChatHistory
     * const aiChatHistory = await prisma.aiChatHistory.upsert({
     *   create: {
     *     // ... data to create a AiChatHistory
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the AiChatHistory we want to update
     *   }
     * })
     */
    upsert<T extends AiChatHistoryUpsertArgs>(args: Prisma.SelectSubset<T, AiChatHistoryUpsertArgs<ExtArgs>>): Prisma.Prisma__AiChatHistoryClient<runtime.Types.Result.GetResult<Prisma.$AiChatHistoryPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    /**
     * Count the number of AiChatHistories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AiChatHistoryCountArgs} args - Arguments to filter AiChatHistories to count.
     * @example
     * // Count the number of AiChatHistories
     * const count = await prisma.aiChatHistory.count({
     *   where: {
     *     // ... the filter for the AiChatHistories we want to count
     *   }
     * })
    **/
    count<T extends AiChatHistoryCountArgs>(args?: Prisma.Subset<T, AiChatHistoryCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], AiChatHistoryCountAggregateOutputType> : number>;
    /**
     * Allows you to perform aggregations operations on a AiChatHistory.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AiChatHistoryAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AiChatHistoryAggregateArgs>(args: Prisma.Subset<T, AiChatHistoryAggregateArgs>): Prisma.PrismaPromise<GetAiChatHistoryAggregateType<T>>;
    /**
     * Group by AiChatHistory.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AiChatHistoryGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
    **/
    groupBy<T extends AiChatHistoryGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: AiChatHistoryGroupByArgs['orderBy'];
    } : {
        orderBy?: AiChatHistoryGroupByArgs['orderBy'];
    }, OrderFields extends Prisma.ExcludeUnderscoreKeys<Prisma.Keys<Prisma.MaybeTupleToUnion<T['orderBy']>>>, ByFields extends Prisma.MaybeTupleToUnion<T['by']>, ByValid extends Prisma.Has<ByFields, OrderFields>, HavingFields extends Prisma.GetHavingFields<T['having']>, HavingValid extends Prisma.Has<ByFields, HavingFields>, ByEmpty extends T['by'] extends never[] ? Prisma.True : Prisma.False, InputErrors extends ByEmpty extends Prisma.True ? `Error: "by" must not be empty.` : HavingValid extends Prisma.False ? {
        [P in HavingFields]: P extends ByFields ? never : P extends string ? `Error: Field "${P}" used in "having" needs to be provided in "by".` : [
            Error,
            'Field ',
            P,
            ` in "having" needs to be provided in "by"`
        ];
    }[HavingFields] : 'take' extends Prisma.Keys<T> ? 'orderBy' extends Prisma.Keys<T> ? ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields] : 'Error: If you provide "take", you also need to provide "orderBy"' : 'skip' extends Prisma.Keys<T> ? 'orderBy' extends Prisma.Keys<T> ? ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields] : 'Error: If you provide "skip", you also need to provide "orderBy"' : ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, AiChatHistoryGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAiChatHistoryGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the AiChatHistory model
     */
    readonly fields: AiChatHistoryFieldRefs;
}
/**
 * The delegate class that acts as a "Promise-like" for AiChatHistory.
 * Why is this prefixed with `Prisma__`?
 * Because we want to prevent naming conflicts as mentioned in
 * https://github.com/prisma/prisma-client-js/issues/707
 */
export interface Prisma__AiChatHistoryClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    messages<T extends Prisma.AiChatHistory$messagesArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.AiChatHistory$messagesArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$AiMessagePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
/**
 * Fields of the AiChatHistory model
 */
export interface AiChatHistoryFieldRefs {
    readonly id: Prisma.FieldRef<"AiChatHistory", 'String'>;
    readonly sessionId: Prisma.FieldRef<"AiChatHistory", 'String'>;
    readonly title: Prisma.FieldRef<"AiChatHistory", 'String'>;
    readonly summary: Prisma.FieldRef<"AiChatHistory", 'String'>;
    readonly messageCount: Prisma.FieldRef<"AiChatHistory", 'Int'>;
    readonly totalTokens: Prisma.FieldRef<"AiChatHistory", 'BigInt'>;
    readonly firstMessageAt: Prisma.FieldRef<"AiChatHistory", 'DateTime'>;
    readonly lastMessageAt: Prisma.FieldRef<"AiChatHistory", 'DateTime'>;
    readonly metadata: Prisma.FieldRef<"AiChatHistory", 'Json'>;
    readonly deletedAt: Prisma.FieldRef<"AiChatHistory", 'DateTime'>;
}
/**
 * AiChatHistory findUnique
 */
export type AiChatHistoryFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AiChatHistory
     */
    select?: Prisma.AiChatHistorySelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AiChatHistory
     */
    omit?: Prisma.AiChatHistoryOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.AiChatHistoryInclude<ExtArgs> | null;
    /**
     * Filter, which AiChatHistory to fetch.
     */
    where: Prisma.AiChatHistoryWhereUniqueInput;
};
/**
 * AiChatHistory findUniqueOrThrow
 */
export type AiChatHistoryFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AiChatHistory
     */
    select?: Prisma.AiChatHistorySelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AiChatHistory
     */
    omit?: Prisma.AiChatHistoryOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.AiChatHistoryInclude<ExtArgs> | null;
    /**
     * Filter, which AiChatHistory to fetch.
     */
    where: Prisma.AiChatHistoryWhereUniqueInput;
};
/**
 * AiChatHistory findFirst
 */
export type AiChatHistoryFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AiChatHistory
     */
    select?: Prisma.AiChatHistorySelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AiChatHistory
     */
    omit?: Prisma.AiChatHistoryOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.AiChatHistoryInclude<ExtArgs> | null;
    /**
     * Filter, which AiChatHistory to fetch.
     */
    where?: Prisma.AiChatHistoryWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of AiChatHistories to fetch.
     */
    orderBy?: Prisma.AiChatHistoryOrderByWithRelationInput | Prisma.AiChatHistoryOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for AiChatHistories.
     */
    cursor?: Prisma.AiChatHistoryWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` AiChatHistories from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` AiChatHistories.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of AiChatHistories.
     */
    distinct?: Prisma.AiChatHistoryScalarFieldEnum | Prisma.AiChatHistoryScalarFieldEnum[];
};
/**
 * AiChatHistory findFirstOrThrow
 */
export type AiChatHistoryFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AiChatHistory
     */
    select?: Prisma.AiChatHistorySelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AiChatHistory
     */
    omit?: Prisma.AiChatHistoryOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.AiChatHistoryInclude<ExtArgs> | null;
    /**
     * Filter, which AiChatHistory to fetch.
     */
    where?: Prisma.AiChatHistoryWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of AiChatHistories to fetch.
     */
    orderBy?: Prisma.AiChatHistoryOrderByWithRelationInput | Prisma.AiChatHistoryOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for AiChatHistories.
     */
    cursor?: Prisma.AiChatHistoryWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` AiChatHistories from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` AiChatHistories.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of AiChatHistories.
     */
    distinct?: Prisma.AiChatHistoryScalarFieldEnum | Prisma.AiChatHistoryScalarFieldEnum[];
};
/**
 * AiChatHistory findMany
 */
export type AiChatHistoryFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AiChatHistory
     */
    select?: Prisma.AiChatHistorySelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AiChatHistory
     */
    omit?: Prisma.AiChatHistoryOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.AiChatHistoryInclude<ExtArgs> | null;
    /**
     * Filter, which AiChatHistories to fetch.
     */
    where?: Prisma.AiChatHistoryWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of AiChatHistories to fetch.
     */
    orderBy?: Prisma.AiChatHistoryOrderByWithRelationInput | Prisma.AiChatHistoryOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing AiChatHistories.
     */
    cursor?: Prisma.AiChatHistoryWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` AiChatHistories from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` AiChatHistories.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of AiChatHistories.
     */
    distinct?: Prisma.AiChatHistoryScalarFieldEnum | Prisma.AiChatHistoryScalarFieldEnum[];
};
/**
 * AiChatHistory create
 */
export type AiChatHistoryCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AiChatHistory
     */
    select?: Prisma.AiChatHistorySelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AiChatHistory
     */
    omit?: Prisma.AiChatHistoryOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.AiChatHistoryInclude<ExtArgs> | null;
    /**
     * The data needed to create a AiChatHistory.
     */
    data: Prisma.XOR<Prisma.AiChatHistoryCreateInput, Prisma.AiChatHistoryUncheckedCreateInput>;
};
/**
 * AiChatHistory createMany
 */
export type AiChatHistoryCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * The data used to create many AiChatHistories.
     */
    data: Prisma.AiChatHistoryCreateManyInput | Prisma.AiChatHistoryCreateManyInput[];
    skipDuplicates?: boolean;
};
/**
 * AiChatHistory createManyAndReturn
 */
export type AiChatHistoryCreateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AiChatHistory
     */
    select?: Prisma.AiChatHistorySelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the AiChatHistory
     */
    omit?: Prisma.AiChatHistoryOmit<ExtArgs> | null;
    /**
     * The data used to create many AiChatHistories.
     */
    data: Prisma.AiChatHistoryCreateManyInput | Prisma.AiChatHistoryCreateManyInput[];
    skipDuplicates?: boolean;
};
/**
 * AiChatHistory update
 */
export type AiChatHistoryUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AiChatHistory
     */
    select?: Prisma.AiChatHistorySelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AiChatHistory
     */
    omit?: Prisma.AiChatHistoryOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.AiChatHistoryInclude<ExtArgs> | null;
    /**
     * The data needed to update a AiChatHistory.
     */
    data: Prisma.XOR<Prisma.AiChatHistoryUpdateInput, Prisma.AiChatHistoryUncheckedUpdateInput>;
    /**
     * Choose, which AiChatHistory to update.
     */
    where: Prisma.AiChatHistoryWhereUniqueInput;
};
/**
 * AiChatHistory updateMany
 */
export type AiChatHistoryUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * The data used to update AiChatHistories.
     */
    data: Prisma.XOR<Prisma.AiChatHistoryUpdateManyMutationInput, Prisma.AiChatHistoryUncheckedUpdateManyInput>;
    /**
     * Filter which AiChatHistories to update
     */
    where?: Prisma.AiChatHistoryWhereInput;
    /**
     * Limit how many AiChatHistories to update.
     */
    limit?: number;
};
/**
 * AiChatHistory updateManyAndReturn
 */
export type AiChatHistoryUpdateManyAndReturnArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AiChatHistory
     */
    select?: Prisma.AiChatHistorySelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the AiChatHistory
     */
    omit?: Prisma.AiChatHistoryOmit<ExtArgs> | null;
    /**
     * The data used to update AiChatHistories.
     */
    data: Prisma.XOR<Prisma.AiChatHistoryUpdateManyMutationInput, Prisma.AiChatHistoryUncheckedUpdateManyInput>;
    /**
     * Filter which AiChatHistories to update
     */
    where?: Prisma.AiChatHistoryWhereInput;
    /**
     * Limit how many AiChatHistories to update.
     */
    limit?: number;
};
/**
 * AiChatHistory upsert
 */
export type AiChatHistoryUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AiChatHistory
     */
    select?: Prisma.AiChatHistorySelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AiChatHistory
     */
    omit?: Prisma.AiChatHistoryOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.AiChatHistoryInclude<ExtArgs> | null;
    /**
     * The filter to search for the AiChatHistory to update in case it exists.
     */
    where: Prisma.AiChatHistoryWhereUniqueInput;
    /**
     * In case the AiChatHistory found by the `where` argument doesn't exist, create a new AiChatHistory with this data.
     */
    create: Prisma.XOR<Prisma.AiChatHistoryCreateInput, Prisma.AiChatHistoryUncheckedCreateInput>;
    /**
     * In case the AiChatHistory was found with the provided `where` argument, update it with this data.
     */
    update: Prisma.XOR<Prisma.AiChatHistoryUpdateInput, Prisma.AiChatHistoryUncheckedUpdateInput>;
};
/**
 * AiChatHistory delete
 */
export type AiChatHistoryDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AiChatHistory
     */
    select?: Prisma.AiChatHistorySelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AiChatHistory
     */
    omit?: Prisma.AiChatHistoryOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.AiChatHistoryInclude<ExtArgs> | null;
    /**
     * Filter which AiChatHistory to delete.
     */
    where: Prisma.AiChatHistoryWhereUniqueInput;
};
/**
 * AiChatHistory deleteMany
 */
export type AiChatHistoryDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Filter which AiChatHistories to delete
     */
    where?: Prisma.AiChatHistoryWhereInput;
    /**
     * Limit how many AiChatHistories to delete.
     */
    limit?: number;
};
/**
 * AiChatHistory.messages
 */
export type AiChatHistory$messagesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AiMessage
     */
    select?: Prisma.AiMessageSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AiMessage
     */
    omit?: Prisma.AiMessageOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.AiMessageInclude<ExtArgs> | null;
    where?: Prisma.AiMessageWhereInput;
    orderBy?: Prisma.AiMessageOrderByWithRelationInput | Prisma.AiMessageOrderByWithRelationInput[];
    cursor?: Prisma.AiMessageWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.AiMessageScalarFieldEnum | Prisma.AiMessageScalarFieldEnum[];
};
/**
 * AiChatHistory without action
 */
export type AiChatHistoryDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AiChatHistory
     */
    select?: Prisma.AiChatHistorySelect<ExtArgs> | null;
    /**
     * Omit specific fields from the AiChatHistory
     */
    omit?: Prisma.AiChatHistoryOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: Prisma.AiChatHistoryInclude<ExtArgs> | null;
};
