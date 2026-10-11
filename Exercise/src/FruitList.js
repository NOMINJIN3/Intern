import React from 'react' 

import Fruit from './Fruit'  

 export default function FruitList({ fruits, toggleFruit }) { 

   return fruits.map(fruit => { 

     return <Fruit key={fruit.id} toggleFruit={toggleFruit} fruit={fruit}/>  

   })  

}  