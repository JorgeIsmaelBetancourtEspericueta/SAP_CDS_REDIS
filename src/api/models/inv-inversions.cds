namespace inv;

entity priceshistory {
    key ID         : Integer;
        DATE       : DateTime;
        OPEN       : Decimal;
        HIGH       : Decimal;
        LOW        : Decimal;
        CLOSE      : Decimal;
        VOLUME     : Decimal;
        DETAIL_ROW : array of {
            ACTIVED        : Boolean;
            DELETED        : Boolean;
            DETAIL_ROW_REG : array of {
                CURRENT : Boolean;
                REGDATE : DateTime;
                REGTIME : DateTime;
                REGUSER : String;
            }
        }
}

entity strategies {
    key ID          : Integer;
        NAME        : String;
        DESCRIPTION : String;
        TIME        : Time;
        RISK        : Double;
}
