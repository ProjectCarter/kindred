/**
 * Verified U.S. state identity facts for State at a Glance text blocks.
 * Sources: state libraries, legislatures, and NARA statehood records.
 * Symbol photographs are added separately in stateAtAGlanceAssets.ts.
 */

export type StateAtAGlanceTextFacts = {
  stateCode: string;
  stateName: string;
  sectionTitle: string;
  statehood: string;
  nickname: string;
  /** Official state motto when established in law — omitted otherwise. */
  motto?: string;
  capital: string;
};

function fact(
  stateCode: string,
  stateName: string,
  statehood: string,
  nickname: string,
  capital: string,
  motto?: string
): StateAtAGlanceTextFacts {
  return {
    stateCode,
    stateName,
    sectionTitle: `${stateName} at a Glance`,
    statehood,
    nickname,
    capital,
    ...(motto ? { motto } : {}),
  };
}

/** Verified text facts for all 50 U.S. states. */
export const US_STATE_TEXT_FACTS: Record<string, StateAtAGlanceTextFacts> = {
  AL: fact("AL", "Alabama", "December 14, 1819 • 22nd State", "The Yellowhammer State", "Montgomery", "Audemus jura nostra defendere"),
  AK: fact("AK", "Alaska", "January 3, 1959 • 49th State", "The Last Frontier", "Juneau", "North to the Future"),
  AZ: fact("AZ", "Arizona", "February 14, 1912 • 48th State", "The Grand Canyon State", "Phoenix", "Ditat Deus"),
  AR: fact("AR", "Arkansas", "June 15, 1836 • 25th State", "The Natural State", "Little Rock", "Regnat populus"),
  CA: fact("CA", "California", "September 9, 1850 • 31st State", "The Golden State", "Sacramento", "Eureka"),
  CO: fact("CO", "Colorado", "August 1, 1876 • 38th State", "The Centennial State", "Denver", "Nil sine numine"),
  CT: fact("CT", "Connecticut", "January 9, 1788 • 5th State", "The Constitution State", "Hartford", "Qui transtulit sustinet"),
  DE: fact("DE", "Delaware", "December 7, 1787 • 1st State", "The First State", "Dover", "Liberty and Independence"),
  FL: fact("FL", "Florida", "March 3, 1845 • 27th State", "The Sunshine State", "Tallahassee", "In God We Trust"),
  GA: fact("GA", "Georgia", "January 2, 1788 • 4th State", "The Peach State", "Atlanta", "Wisdom, Justice, and Moderation"),
  HI: fact("HI", "Hawaii", "August 21, 1959 • 50th State", "The Aloha State", "Honolulu", "Ua Mau ke Ea o ka ʻĀina i ka Pono"),
  ID: fact("ID", "Idaho", "July 3, 1890 • 43rd State", "The Gem State", "Boise", "Esto perpetua"),
  IL: fact("IL", "Illinois", "December 3, 1818 • 21st State", "The Prairie State", "Springfield", "State Sovereignty, National Union"),
  IN: fact("IN", "Indiana", "December 11, 1816 • 19th State", "The Hoosier State", "Indianapolis", "The Crossroads of America"),
  IA: fact("IA", "Iowa", "December 28, 1846 • 29th State", "The Hawkeye State", "Des Moines", "Our liberties we prize and our rights we will maintain"),
  KS: fact("KS", "Kansas", "January 29, 1861 • 34th State", "The Sunflower State", "Topeka", "Ad astra per aspera"),
  KY: fact("KY", "Kentucky", "June 1, 1792 • 15th State", "The Bluegrass State", "Frankfort", "United we stand, divided we fall"),
  LA: fact("LA", "Louisiana", "April 30, 1812 • 18th State", "The Pelican State", "Baton Rouge", "Union, Justice, and Confidence"),
  ME: fact("ME", "Maine", "March 15, 1820 • 23rd State", "The Pine Tree State", "Augusta", "Dirigo"),
  MD: fact("MD", "Maryland", "April 28, 1788 • 7th State", "The Old Line State", "Annapolis", "Fatti maschii, parole femine"),
  MA: fact("MA", "Massachusetts", "February 6, 1788 • 6th State", "The Bay State", "Boston", "Ense petit placidam sub libertate quietem"),
  MI: fact("MI", "Michigan", "January 26, 1837 • 26th State", "The Great Lakes State", "Lansing", "Si quaeris peninsulam amoenam circumspice"),
  MN: fact("MN", "Minnesota", "May 11, 1858 • 32nd State", "The North Star State", "Saint Paul", "L'Étoile du Nord"),
  MS: fact("MS", "Mississippi", "December 10, 1817 • 20th State", "The Magnolia State", "Jackson", "Virtute et armis"),
  MO: fact("MO", "Missouri", "August 10, 1821 • 24th State", "The Show-Me State", "Jefferson City", "Salus populi suprema lex esto"),
  MT: fact("MT", "Montana", "November 8, 1889 • 41st State", "The Treasure State", "Helena", "Oro y plata"),
  NE: fact("NE", "Nebraska", "March 1, 1867 • 37th State", "The Cornhusker State", "Lincoln", "Equality Before the Law"),
  NV: fact("NV", "Nevada", "October 31, 1864 • 36th State", "The Silver State", "Carson City", "All for Our Country"),
  NH: fact("NH", "New Hampshire", "June 21, 1788 • 9th State", "The Granite State", "Concord", "Live Free or Die"),
  NJ: fact("NJ", "New Jersey", "December 18, 1787 • 3rd State", "The Garden State", "Trenton", "Liberty and Prosperity"),
  NM: fact("NM", "New Mexico", "January 6, 1912 • 47th State", "The Land of Enchantment", "Santa Fe", "Crescit eundo"),
  NY: fact("NY", "New York", "July 26, 1788 • 11th State", "The Empire State", "Albany", "Excelsior"),
  NC: fact("NC", "North Carolina", "November 21, 1789 • 12th State", "The Tar Heel State", "Raleigh", "Esse quam videri"),
  ND: fact("ND", "North Dakota", "November 2, 1889 • 39th State", "The Peace Garden State", "Bismarck", "Liberty and Union, Now and Forever, One and Inseparable"),
  OH: fact("OH", "Ohio", "March 1, 1803 • 17th State", "The Buckeye State", "Columbus", "With God, all things are possible"),
  OK: fact("OK", "Oklahoma", "November 16, 1907 • 46th State", "The Sooner State", "Oklahoma City", "Labor omnia vincit"),
  OR: fact("OR", "Oregon", "February 14, 1859 • 33rd State", "The Beaver State", "Salem", "Alis volat propriis"),
  PA: fact("PA", "Pennsylvania", "December 12, 1787 • 2nd State", "The Keystone State", "Harrisburg", "Virtue, Liberty, and Independence"),
  RI: fact("RI", "Rhode Island", "May 29, 1790 • 13th State", "The Ocean State", "Providence", "Hope"),
  SC: fact("SC", "South Carolina", "May 23, 1788 • 8th State", "The Palmetto State", "Columbia", "Dum spiro spero"),
  SD: fact("SD", "South Dakota", "November 2, 1889 • 40th State", "The Mount Rushmore State", "Pierre", "Under God the people rule"),
  TN: fact("TN", "Tennessee", "June 1, 1796 • 16th State", "The Volunteer State", "Nashville", "Agriculture and Commerce"),
  TX: fact("TX", "Texas", "December 29, 1845 • 28th State", "The Lone Star State", "Austin", "Friendship"),
  UT: fact("UT", "Utah", "January 4, 1896 • 45th State", "The Beehive State", "Salt Lake City", "Industry"),
  VT: fact("VT", "Vermont", "March 4, 1791 • 14th State", "The Green Mountain State", "Montpelier", "Freedom and Unity"),
  VA: fact("VA", "Virginia", "June 25, 1788 • 10th State", "The Old Dominion", "Richmond", "Sic semper tyrannis"),
  WA: fact("WA", "Washington", "November 11, 1889 • 42nd State", "The Evergreen State", "Olympia"),
  WV: fact("WV", "West Virginia", "June 20, 1863 • 35th State", "The Mountain State", "Charleston", "Montani semper liberi"),
  WI: fact("WI", "Wisconsin", "May 29, 1848 • 30th State", "The Badger State", "Madison", "Forward"),
  WY: fact("WY", "Wyoming", "July 10, 1890 • 44th State", "The Equality State", "Cheyenne", "Equal Rights"),
};

export const US_STATE_CODES = Object.keys(US_STATE_TEXT_FACTS).sort();

export function hasVerifiedStateTextFacts(
  facts: StateAtAGlanceTextFacts | null | undefined
): boolean {
  if (!facts) return false;
  return Boolean(
    facts.statehood.trim() &&
      facts.nickname.trim() &&
      facts.capital.trim() &&
      facts.stateName.trim()
  );
}
