/** Decimal-safe arithmetic at the database's cent precision. Sub-cent results are
 * rejected until a rounding policy is approved; never silently round game money. */
export function cents(value:number|string):bigint {
  const text=String(value);
  if(!/^-?\d+(\.\d{1,2})?$/.test(text)) throw new Error("Le montant doit être exprimé au centime près.");
  const negative=text.startsWith("-");const [whole,fraction=""]=text.replace("-","").split(".");
  return (BigInt(whole)*BigInt(100)+BigInt(fraction.padEnd(2,"0")))*(negative?BigInt(-1):BigInt(1));
}
export function euros(value:bigint):number {
  if(value>BigInt(Number.MAX_SAFE_INTEGER)||value<BigInt(Number.MIN_SAFE_INTEGER)) throw new Error("Montant hors limites.");
  return Number(value)/100;
}
export function moneySum(...values:number[]):number {return euros(values.reduce((sum,value)=>sum+cents(value),BigInt(0)));}
export function moneyRatio(amount:number,numerator:number,denominator:number):number {
  const top=cents(amount)*BigInt(numerator),bottom=BigInt(denominator);
  if(bottom<=BigInt(0)||top%bottom!==BigInt(0)) throw new Error("Ce calcul nécessite une règle d’arrondi au centime.");
  return euros(top/bottom);
}
