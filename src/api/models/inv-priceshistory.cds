namespace x;

entity priceshistory {
    key ID             : Integer;
        DATE           : DateTime;
        OPEN           : Decimal;
        HIGH           : Decimal;
        LOW            : Decimal;
        CLOSE          : Decimal;
        VOLUME         : Decimal;
        DETAIL_ROW_REG : array of {
            CURRENT : Boolean;
            REGDATE : DateTime;
            REGTIME : DateTime;
            REGUSER : String;
        }
}
